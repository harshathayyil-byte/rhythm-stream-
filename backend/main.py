from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Field, Session, SQLModel, create_engine, select
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import httpx
import os
import time
import yt_dlp
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
DEEZER_API_BASE_URL = os.getenv("DEEZER_API_BASE_URL", "https://api.deezer.com")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///rhythm_stream.db")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

print(f"Connecting to database at: {DATABASE_URL}")

import bcrypt

# --- Security Setup ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Simple in-memory cache for stream URLs (TTL: 1 hour)
stream_url_cache = {}
CACHE_TTL = 3600

# --- Models ---
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(unique=True)
    hashed_password: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Favorite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    track_id: int # Deezer track ID
    track_title: str
    artist_name: str
    album_cover: Optional[str] = None

class FavoriteCreate(BaseModel):
    track_id: int
    track_title: str
    artist_name: str
    album_cover: Optional[str] = None

# --- Database ---
engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    statement = select(User).where(User.username == username)
    user = session.exec(statement).first()
    if user is None:
        raise credentials_exception
    return user

# --- FastAPI App ---
app = FastAPI(title="Rhythm Stream API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# --- Auth Endpoints ---
@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate, session: Session = Depends(get_session)):
    # Check if user exists
    statement = select(User).where((User.username == user_data.username) | (User.email == user_data.email))
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password)
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    statement = select(User).where((User.username == form_data.username) | (User.email == form_data.username))
    user = session.exec(statement).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email}

# --- Deezer Proxy ---
@app.get("/api/search")
async def search_music(q: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{DEEZER_API_BASE_URL}/search", params={"q": q})
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Deezer API Error")
        return response.json()

@app.get("/api/album/{album_id}")
async def get_album(album_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{DEEZER_API_BASE_URL}/album/{album_id}")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Deezer API Error")
        return response.json()

@app.get("/api/artist/{artist_id}")
async def get_artist(artist_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{DEEZER_API_BASE_URL}/artist/{artist_id}")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Deezer API Error")
        return response.json()

@app.get("/api/chart")
async def get_chart():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{DEEZER_API_BASE_URL}/chart")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Deezer API Error")
        return response.json()

@app.get("/api/stream/{track_id}")
async def get_stream_url(track_id: int):
    # Check cache first
    now = time.time()
    if track_id in stream_url_cache:
        url, expiry = stream_url_cache[track_id]
        if now < expiry:
            return {"url": url}

    # Fetch track info from Deezer to get clean title and artist
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{DEEZER_API_BASE_URL}/track/{track_id}")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Track not found on Deezer")
        
        track_data = response.json()
        query = f"{track_data['title']} {track_data['artist']['name']} official audio"

    # Search and extract direct audio URL using yt-dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
    }

    try:
        # We use a separate thread/process if needed, but for simple use extract_info is okay
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch1:{query}", download=False)
            if 'entries' in info and len(info['entries']) > 0:
                audio_url = info['entries'][0]['url']
                # Cache the URL
                stream_url_cache[track_id] = (audio_url, now + CACHE_TTL)
                return {"url": audio_url}
            else:
                raise HTTPException(status_code=404, detail="Audio stream not found on YouTube")
    except Exception as e:
        print(f"yt-dlp error: {e}")
        raise HTTPException(status_code=500, detail="Error extracting audio stream")

# --- Favorites Endpoints (Authenticated) ---
@app.post("/api/favorites")
async def add_favorite(favorite_data: FavoriteCreate, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    favorite = Favorite(
        user_id=current_user.id,
        track_id=favorite_data.track_id,
        track_title=favorite_data.track_title,
        artist_name=favorite_data.artist_name,
        album_cover=favorite_data.album_cover
    )
    session.add(favorite)
    session.commit()
    session.refresh(favorite)
    return favorite

@app.get("/api/favorites")
async def get_favorites(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Favorite).where(Favorite.user_id == current_user.id)
    results = session.exec(statement)
    return results.all()

@app.delete("/api/favorites/{track_id}")
async def remove_favorite(track_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    statement = select(Favorite).where(Favorite.user_id == current_user.id).where(Favorite.track_id == track_id)
    results = session.exec(statement)
    favorite = results.first()
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    session.delete(favorite)
    session.commit()
    return {"message": "Removed from favorites"}

@app.get("/")
def read_root():
    return {"message": "Welcome to Rhythm Stream API"}

