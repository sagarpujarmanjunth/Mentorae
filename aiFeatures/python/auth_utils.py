import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, session
from supabase import create_client, Client
from dotenv import load_dotenv, find_dotenv

# Load environment variables safely from nearest .env (if present)
try:
    load_dotenv(find_dotenv(), override=False)
except Exception:
    # Silently continue; we'll validate variables below
    pass

# Supabase configuration with common fallbacks
SUPABASE_URL = (
    os.getenv("SUPABASE_URL")
    or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
)
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
)
SUPABASE_SERVICE_KEY = (
    os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Defer Supabase client creation until first use to avoid crashing on import
_supabase_client: Client | None = None
_supabase_admin_client: Client | None = None


def _create_clients_if_configured() -> tuple[Client | None, Client | None, str | None]:
    """Create supabase clients if env vars are present; return error message if not."""
    error_message = None
    global _supabase_client, _supabase_admin_client

    if _supabase_client is not None and _supabase_admin_client is not None:
        return _supabase_client, _supabase_admin_client, None

    if not SUPABASE_URL:
        error_message = (
            "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) environment variable"
        )
        return None, None, error_message

    if not SUPABASE_KEY:
        error_message = (
            "Missing SUPABASE_KEY (or SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY) environment variable"
        )
        return None, None, error_message

    # Service key is optional; when absent, admin ops will reuse anon client
    try:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        if SUPABASE_SERVICE_KEY:
            _supabase_admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        else:
            _supabase_admin_client = _supabase_client
        return _supabase_client, _supabase_admin_client, None
    except Exception as exc:
        return None, None, f"Failed to initialize Supabase client: {exc}"


class AuthManager:
    def __init__(self):
        # Lazy; real clients are created on first method call
        self.supabase: Client | None = None
        self.supabase_admin: Client | None = None

    def _ensure_clients(self) -> dict | None:
        client, admin_client, error = _create_clients_if_configured()
        if error:
            return {"success": False, "error": error}
        self.supabase = client
        self.supabase_admin = admin_client
        return None

    def sign_up(self, email: str, password: str, user_data: dict = None):
        """Register a new user with Supabase"""
        error = self._ensure_clients()
        if error:
            return error
        try:
            response = self.supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": user_data or {}
                }
            })
            if response.user:
                # Mirror minimal profile into public.users so it appears in dashboard
                try:
                    if SUPABASE_SERVICE_KEY:
                        # Derive names from provided user_data if available
                        full_name = (user_data or {}).get("name", "").strip()
                        first_name = full_name.split(" ")[0] if full_name else ""
                        last_name = " ".join(full_name.split(" ")[1:]) if full_name and len(full_name.split(" ")) > 1 else ""

                        # Your schema requires password_hash NOT NULL; since Supabase Auth manages passwords,
                        # we set a sentinel value. Consider altering the column to be nullable in your DB.
                        upsert_payload = {
                            "id": str(response.user.id),
                            "email": email,
                            "password_hash": "auth_managed",
                            "first_name": first_name,
                            "last_name": last_name,
                            "is_verified": bool(response.user.email_confirmed_at),
                        }

                        # Use admin client to bypass RLS if available
                        self.supabase_admin.table("users").upsert(upsert_payload, on_conflict="id").execute()
                    else:
                        print("[auth_utils] Skipping public.users mirror: SUPABASE_SERVICE_KEY not set.")
                except Exception as mirror_exc:
                    # Don't block signup if profile mirroring fails, but log why
                    print(f"[auth_utils] public.users mirror failed: {mirror_exc}")
                return {
                    "success": True,
                    "user": response.user,
                    "session": response.session,
                    "message": "User registered successfully. Please check your email for verification."
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to create user account"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def sign_in(self, email: str, password: str):
        """Sign in a user with email and password"""
        error = self._ensure_clients()
        if error:
            return error
        try:
            response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            if response.user and response.session:
                # Update last_login in public.users (best-effort)
                try:
                    if SUPABASE_SERVICE_KEY:
                        self.supabase_admin.table("users").update({"last_login": "now()"}).eq("id", str(response.user.id)).execute()
                    else:
                        print("[auth_utils] Skipping last_login update: SUPABASE_SERVICE_KEY not set.")
                except Exception as upd_exc:
                    print(f"[auth_utils] last_login update failed: {upd_exc}")
                return {
                    "success": True,
                    "user": response.user,
                    "session": response.session,
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token
                }
            else:
                return {
                    "success": False,
                    "error": "Invalid credentials"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def sign_out(self, access_token: str = None):
        """Sign out the current user"""
        error = self._ensure_clients()
        if error:
            return error
        try:
            if access_token:
                # Set the session for the specific user
                self.supabase.auth.set_session(access_token, refresh_token="")
            response = self.supabase.auth.sign_out()
            return {
                "success": True,
                "message": "User signed out successfully"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_user(self, access_token: str):
        """Get user information from access token"""
        error = self._ensure_clients()
        if error:
            return error
        try:
            response = self.supabase.auth.get_user(access_token)
            if response.user:
                return {
                    "success": True,
                    "user": response.user
                }
            else:
                return {
                    "success": False,
                    "error": "Invalid token"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def refresh_session(self, refresh_token: str):
        """Refresh user session"""
        error = self._ensure_clients()
        if error:
            return error
        try:
            response = self.supabase.auth.refresh_session(refresh_token)
            if response.session:
                return {
                    "success": True,
                    "session": response.session,
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to refresh session"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def verify_token(self, token: str):
        """Verify token using Supabase"""
        error = self._ensure_clients()
        if error:
            return error
        try:
            response = self.supabase.auth.get_user(token)
            if response.user:
                return {
                    "success": True,
                    "user": response.user
                }
            else:
                return {
                    "success": False,
                    "error": "Invalid token"
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def generate_token(self, user_data: dict, expires_in_hours: int = 24):
        """Generate token - using Supabase's built-in tokens"""
        # Supabase handles token generation automatically
        # This method is kept for compatibility but not used
        return {
            "success": False,
            "error": "Use Supabase's built-in authentication tokens"
        }

# Create global instance
auth_manager = AuthManager()


def require_auth(f):
    """Decorator to require authentication for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for token in headers
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "No authorization header"}), 401
        try:
            # Extract token (assuming "Bearer <token>" format)
            token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header
            # Verify with Supabase
            user_response = auth_manager.get_user(token)
            if not user_response["success"]:
                return jsonify({"error": user_response.get("error", "Invalid or expired token")}), 401
            # Add user info to request context
            request.current_user = user_response["user"]
        except (IndexError, KeyError):
            return jsonify({"error": "Invalid authorization header format"}), 401
        except Exception as e:
            return jsonify({"error": str(e)}), 401
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    """Get current authenticated user from request context"""
    return getattr(request, 'current_user', None)