"""
Security utilities for JWT authentication and password hashing.
Uses modern Python 3.11+ typing and async patterns with hashlib.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from pydantic import ValidationError

from app.core.config import settings

# Constants for password hashing
SALT_LENGTH = 32  # 256 bits
HASH_ITERATIONS = 100_000  # OWASP recommended minimum
HASH_ALGORITHM = 'sha256'


def create_access_token(subject: str | uuid.UUID, expires_delta: timedelta | None = None) -> str:
    """
    Create a JWT access token.

    Args:
        subject: User ID or username to encode in token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Convert UUID to string if needed
    subject_str = str(subject) if isinstance(subject, uuid.UUID) else subject

    to_encode = {"exp": expire, "sub": subject_str, "type": "access_token"}

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict[str, Any] | None:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string to verify

    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # Check token type
        if payload.get("type") != "access_token":
            return None

        # Check expiration
        exp = payload.get("exp")
        if exp is None:
            return None

        if datetime.fromtimestamp(exp, timezone.utc) < datetime.now(timezone.utc):
            return None

        return payload

    except (JWTError, ValidationError):
        return None


def get_password_hash(password: str) -> str:
    """
    Hash a password using PBKDF2-HMAC with SHA256 and secure salt.
    
    Follows OWASP recommendations for password hashing:
    - PBKDF2 with SHA256
    - 100,000+ iterations
    - 256-bit cryptographically secure random salt
    
    Args:
        password: Plain text password

    Returns:
        Hashed password string in format: iterations$salt$hash (base64 encoded)
    """
    # Generate cryptographically secure random salt
    salt = secrets.token_bytes(SALT_LENGTH)
    
    # Hash the password with PBKDF2-HMAC
    password_hash = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        password.encode('utf-8'),
        salt,
        HASH_ITERATIONS
    )
    
    # Combine iterations, salt, and hash for storage
    # Format: iterations$salt$hash (all base64 encoded for safe storage)
    import base64
    salt_b64 = base64.b64encode(salt).decode('ascii')
    hash_b64 = base64.b64encode(password_hash).decode('ascii')
    
    return f"{HASH_ITERATIONS}${salt_b64}${hash_b64}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash using constant-time comparison.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Stored password hash in format iterations$salt$hash

    Returns:
        True if password matches, False otherwise
    """
    try:
        import base64
        
        # Parse the stored hash components
        parts = hashed_password.split('$')
        if len(parts) != 3:
            return False
            
        iterations_str, salt_b64, stored_hash_b64 = parts
        
        # Extract iterations, salt, and stored hash
        iterations = int(iterations_str)
        salt = base64.b64decode(salt_b64.encode('ascii'))
        stored_hash = base64.b64decode(stored_hash_b64.encode('ascii'))
        
        # Hash the provided password with the same salt and iterations
        password_hash = hashlib.pbkdf2_hmac(
            HASH_ALGORITHM,
            plain_password.encode('utf-8'),
            salt,
            iterations
        )
        
        # Use constant-time comparison to prevent timing attacks
        return secrets.compare_digest(password_hash, stored_hash)
        
    except (ValueError, TypeError, base64.binascii.Error):
        # Invalid hash format or decoding error
        return False


def generate_password_reset_token(email: str) -> str:
    """
    Generate a password reset token.

    Args:
        email: User email address

    Returns:
        JWT token for password reset
    """
    delta = timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS)
    now = datetime.now(timezone.utc)
    expires = now + delta

    exp = expires.timestamp()
    encoded_jwt = jwt.encode(
        {"exp": exp, "nbf": now, "sub": email, "type": "password_reset"},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return encoded_jwt


def verify_password_reset_token(token: str) -> str | None:
    """
    Verify a password reset token.

    Args:
        token: Password reset token

    Returns:
        Email address if token is valid, None otherwise
    """
    try:
        decoded_token = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        if decoded_token.get("type") != "password_reset":
            return None

        return decoded_token["sub"]

    except JWTError:
        return None
