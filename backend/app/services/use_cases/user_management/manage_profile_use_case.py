"""
Manage Profile Use Case - User Profile Management Business Workflow.

Handles comprehensive user profile management including:
- Profile information updates and validation
- Password changes with security policies
- MFA setup and configuration
- Preference management and customization
- Avatar and profile image handling
- Account settings and privacy controls
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from uuid import UUID
from enum import Enum
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.schemas.services.user_schemas import UserServiceSchema
from app.services.orm_services.user_orm_service import UserOrmService
# from app.services.orm_services.user_preference_orm_service import UserPreferenceOrmService  # TODO: Implement when user preferences are needed
from app.core.security import verify_password
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class ProfileAction(Enum):
    """Profile management actions."""
    UPDATE_INFO = "update_info"
    CHANGE_PASSWORD = "change_password"
    SETUP_MFA = "setup_mfa"
    DISABLE_MFA = "disable_mfa"
    UPDATE_PREFERENCES = "update_preferences"
    UPLOAD_AVATAR = "upload_avatar"
    UPDATE_PRIVACY_SETTINGS = "update_privacy_settings"
    DEACTIVATE_ACCOUNT = "deactivate_account"


class MfaMethod(Enum):
    """Multi-factor authentication methods."""
    TOTP = "totp"
    SMS = "sms"
    EMAIL = "email"
    BACKUP_CODES = "backup_codes"


@dataclass
class ManageProfileRequest:
    """Request object for profile management operations."""
    action: ProfileAction
    user_id: Optional[UUID] = None  # None = current user
    
    # Profile info updates
    full_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    
    # Password change
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    confirm_password: Optional[str] = None
    
    # MFA setup
    mfa_method: Optional[MfaMethod] = None
    mfa_secret: Optional[str] = None
    mfa_code: Optional[str] = None
    backup_phone: Optional[str] = None
    
    # Preferences
    preferences: Optional[Dict[str, Any]] = None
    
    # Avatar/Image
    avatar_data: Optional[bytes] = None
    avatar_filename: Optional[str] = None
    
    # Privacy settings
    privacy_settings: Optional[Dict[str, Any]] = None
    
    # Account deactivation
    deactivation_reason: Optional[str] = None
    deactivate_immediately: bool = False


@dataclass
class ManageProfileResponse:
    """Response object for profile management operations."""
    user: UserServiceSchema
    action_taken: ProfileAction
    mfa_setup_data: Optional[Dict[str, Any]] = None
    password_changed: bool = False
    preferences_updated: bool = False
    avatar_url: Optional[str] = None
    backup_codes: Optional[list[str]] = None


class ManageProfileUseCase(BaseUseCase[ManageProfileRequest, ManageProfileResponse]):
    """
    Use case for comprehensive user profile management operations.

    Responsibilities:
    - Update user profile information with validation
    - Handle secure password changes with policy enforcement
    - Set up and manage multi-factor authentication
    - Manage user preferences and customization
    - Handle avatar uploads and profile images
    - Apply privacy settings and account controls

    Events Published:
    - Profile update events (nlj.user.profile_updated)
    - Password change events (nlj.user.password_changed)
    - MFA setup events (nlj.user.mfa_enabled/disabled)
    - Preference update events (nlj.user.preferences_updated)
    - Account deactivation events (nlj.user.account_deactivated)
    """

    def __init__(
        self,
        session: AsyncSession,
        user_orm_service: UserOrmService,
        # user_preference_orm_service: UserPreferenceOrmService  # TODO: Implement when user preferences are needed
    ):
        """
        Initialize manage profile use case.

        Args:
            session: Database session for transaction management
            user_orm_service: User data access and management
            user_preference_orm_service: User preference management
        """
        super().__init__(
            session,
            user_orm_service=user_orm_service,
            # user_preference_orm_service=user_preference_orm_service  # TODO: Implement when user preferences are needed
        )

    async def execute(
        self,
        request: ManageProfileRequest,
        user_context: Dict[str, Any]
    ) -> ManageProfileResponse:
        """
        Execute profile management workflow.

        Args:
            request: Profile management request with action and data
            user_context: User context for permissions and validation

        Returns:
            Profile management response with updated information

        Raises:
            PermissionError: If user lacks profile management permissions
            ValueError: If request validation fails
            RuntimeError: If profile management fails
        """
        try:
            # Determine target user (self or other)
            target_user_id = request.user_id or UUID(user_context["user_id"])
            
            # Validate permissions
            await self._validate_profile_permissions(target_user_id, user_context)

            # Get target user
            target_user = await self._get_target_user(target_user_id)

            # Route to specific action handler
            if request.action == ProfileAction.UPDATE_INFO:
                updated_user, extra_data = await self._handle_update_info(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.CHANGE_PASSWORD:
                updated_user, extra_data = await self._handle_change_password(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.SETUP_MFA:
                updated_user, extra_data = await self._handle_setup_mfa(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.DISABLE_MFA:
                updated_user, extra_data = await self._handle_disable_mfa(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.UPDATE_PREFERENCES:
                updated_user, extra_data = await self._handle_update_preferences(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.UPLOAD_AVATAR:
                updated_user, extra_data = await self._handle_upload_avatar(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.UPDATE_PRIVACY_SETTINGS:
                updated_user, extra_data = await self._handle_update_privacy_settings(
                    request, target_user, user_context
                )
            elif request.action == ProfileAction.DEACTIVATE_ACCOUNT:
                updated_user, extra_data = await self._handle_deactivate_account(
                    request, target_user, user_context
                )
            else:
                raise ValueError(f"Unsupported profile action: {request.action}")

            # Create response
            response = ManageProfileResponse(
                user=UserServiceSchema(  # type: ignore
                    id=updated_user.id,
                    email=updated_user.email,
                    username=getattr(updated_user, 'username', ''),
                    full_name=getattr(updated_user, 'full_name', ''),
                    role=getattr(updated_user, 'role', 'learner'),
                    is_active=getattr(updated_user, 'is_active', True),
                    created_at=getattr(updated_user, 'created_at', ''),
                    updated_at=getattr(updated_user, 'updated_at', '')
                ),
                action_taken=request.action,
                mfa_setup_data=extra_data.get("mfa_setup_data"),
                password_changed=extra_data.get("password_changed", False),
                preferences_updated=extra_data.get("preferences_updated", False),
                avatar_url=extra_data.get("avatar_url"),
                backup_codes=extra_data.get("backup_codes")
            )

            # Publish profile management event
            await self._publish_profile_management_event(response, request, user_context)

            logger.info(
                f"Profile management completed: {request.action.value} for user {target_user_id}"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"profile management {request.action.value}")
        except Exception as e:
            await self._handle_service_error(e, f"profile management {request.action.value}")
            raise  # This should never be reached but satisfies mypy

    async def _validate_profile_permissions(
        self,
        target_user_id: UUID,
        user_context: Dict[str, Any]
    ) -> None:
        """Validate profile management permissions."""
        current_user_id = UUID(user_context["user_id"])
        user_role = user_context.get("user_role")

        # Users can manage their own profiles
        if target_user_id == current_user_id:
            return

        # Admins can manage any profile
        if user_role == UserRole.ADMIN:
            return

        raise PermissionError("Insufficient permissions to manage this user's profile")

    async def _get_target_user(self, user_id: UUID) -> Any:
        """Get target user with validation."""
        user_orm_service = self.dependencies["user_orm_service"]
        user = await user_orm_service.get_by_id(user_id)

        if not user:
            raise ValueError(f"User not found: {user_id}")

        return user

    async def _handle_update_info(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle profile information updates."""
        # Build update data
        update_data = {}
        
        if request.full_name is not None:
            update_data["full_name"] = request.full_name.strip()
        
        if request.email is not None:
            # Validate email format and uniqueness
            await self._validate_email_update(request.email, target_user.id)
            update_data["email"] = request.email.lower().strip()
        
        if request.username is not None:
            # Validate username uniqueness
            await self._validate_username_update(request.username, target_user.id)
            update_data["username"] = request.username.strip()
        
        if request.bio is not None:
            update_data["bio"] = request.bio.strip() if request.bio else None
        
        if request.phone is not None:
            update_data["phone"] = request.phone.strip() if request.phone else None
        
        if request.timezone is not None:
            update_data["timezone"] = request.timezone
        
        if request.language is not None:
            update_data["language"] = request.language

        # Update user information
        user_orm_service = self.dependencies["user_orm_service"]
        updated_user = await user_orm_service.update_by_id(target_user.id, **update_data)

        return updated_user, {"fields_updated": list(update_data.keys())}

    async def _handle_change_password(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle password changes."""
        current_user_id = UUID(user_context["user_id"])
        
        # Validate password change request
        if not request.new_password or not request.confirm_password:
            raise ValueError("New password and confirmation are required")
        
        if request.new_password != request.confirm_password:
            raise ValueError("Password confirmation does not match")

        # For self password change, require current password
        if target_user.id == current_user_id:
            if not request.current_password:
                raise ValueError("Current password is required")
            
            if not verify_password(request.current_password, target_user.password_hash):
                raise ValueError("Current password is incorrect")

        # Validate password strength
        await self._validate_password_strength(request.new_password)

        # Check password history to prevent reuse
        await self._check_password_history(target_user.id, request.new_password)

        # Hash new password (placeholder - would use actual hash function)
        password_hash = f"hashed_{request.new_password}"

        # Update password
        user_orm_service = self.dependencies["user_orm_service"]
        updated_user = await user_orm_service.update_password(
            target_user.id,
            password_hash,
            password_changed_at=datetime.now()
        )

        # Store in password history
        await user_orm_service.add_password_history(
            target_user.id, password_hash
        )

        return updated_user, {"password_changed": True}

    async def _handle_setup_mfa(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle MFA setup."""
        if not request.mfa_method:
            raise ValueError("MFA method is required")

        user_orm_service = self.dependencies["user_orm_service"]
        mfa_setup_data = {}

        if request.mfa_method == MfaMethod.TOTP:
            # Generate TOTP secret if not provided
            mfa_secret = request.mfa_secret or self._generate_totp_secret()
            
            # Validate TOTP code if provided
            if request.mfa_code:
                if not self._validate_totp_code(mfa_secret, request.mfa_code):
                    raise ValueError("Invalid TOTP code")

            # Enable MFA with TOTP
            updated_user = await user_orm_service.enable_mfa(
                target_user.id,
                mfa_method=request.mfa_method.value,
                mfa_secret=mfa_secret
            )

            mfa_setup_data = {
                "method": "totp",
                "secret": mfa_secret,
                "qr_code_url": self._generate_totp_qr_url(target_user.email, mfa_secret)
            }

        elif request.mfa_method == MfaMethod.SMS:
            if not request.backup_phone:
                raise ValueError("Phone number is required for SMS MFA")

            # Validate phone number format
            await self._validate_phone_number(request.backup_phone)

            # Enable MFA with SMS
            updated_user = await user_orm_service.enable_mfa(
                target_user.id,
                mfa_method=request.mfa_method.value,
                backup_phone=request.backup_phone
            )

            mfa_setup_data = {
                "method": "sms",
                "phone": request.backup_phone
            }

        elif request.mfa_method == MfaMethod.BACKUP_CODES:
            # Generate backup codes
            backup_codes = self._generate_backup_codes()

            # Store backup codes
            await user_orm_service.store_backup_codes(
                target_user.id, backup_codes
            )

            updated_user = target_user  # No user model changes for backup codes

            mfa_setup_data = {
                "method": "backup_codes",
                "codes": backup_codes
            }

        else:
            raise ValueError(f"Unsupported MFA method: {request.mfa_method}")

        return updated_user, {"mfa_setup_data": mfa_setup_data}

    async def _handle_disable_mfa(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle MFA disabling."""
        current_user_id = UUID(user_context["user_id"])
        
        # For self MFA disable, require current password or MFA code
        if target_user.id == current_user_id:
            if request.current_password:
                if not verify_password(request.current_password, target_user.password_hash):
                    raise ValueError("Current password is incorrect")
            elif request.mfa_code:
                if not self._validate_current_mfa_code(target_user, request.mfa_code):
                    raise ValueError("Invalid MFA code")
            else:
                raise ValueError("Current password or MFA code is required to disable MFA")

        # Disable MFA
        user_orm_service = self.dependencies["user_orm_service"]
        updated_user = await user_orm_service.disable_mfa(target_user.id)

        return updated_user, {"mfa_disabled": True}

    async def _handle_update_preferences(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle user preference updates."""
        if not request.preferences:
            raise ValueError("Preferences data is required")

        # TODO: Update user preferences when UserPreferenceOrmService is implemented
        # user_preference_orm_service = self.dependencies["user_preference_orm_service"]
        # await user_preference_orm_service.update_preferences(
        #     target_user.id, request.preferences
        # )

        return target_user, {"preferences_updated": True}

    async def _handle_upload_avatar(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle avatar upload."""
        if not request.avatar_data:
            raise ValueError("Avatar image data is required")

        # Validate image
        await self._validate_avatar_image(request.avatar_data, request.avatar_filename)

        # Upload avatar (in real implementation, use file storage service)
        avatar_url = await self._upload_avatar_file(
            target_user.id, request.avatar_data, request.avatar_filename
        )

        # Update user avatar URL
        user_orm_service = self.dependencies["user_orm_service"]
        updated_user = await user_orm_service.update_by_id(
            target_user.id, avatar_url=avatar_url
        )

        return updated_user, {"avatar_url": avatar_url}

    async def _handle_update_privacy_settings(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle privacy settings updates."""
        if not request.privacy_settings:
            raise ValueError("Privacy settings are required")

        # TODO: Update privacy settings when UserPreferenceOrmService is implemented
        # user_preference_orm_service = self.dependencies["user_preference_orm_service"]
        # await user_preference_orm_service.update_privacy_settings(
        #     target_user.id, request.privacy_settings
        # )

        return target_user, {"privacy_updated": True}

    async def _handle_deactivate_account(
        self,
        request: ManageProfileRequest,
        target_user,
        user_context: Dict[str, Any]
    ) -> tuple[Any, Dict[str, Any]]:
        """Handle account deactivation."""
        # Deactivate user account
        user_orm_service = self.dependencies["user_orm_service"]
        updated_user = await user_orm_service.deactivate_user(
            target_user.id,
            deactivation_reason=request.deactivation_reason or "User requested deactivation",
            immediate=request.deactivate_immediately
        )

        return updated_user, {"account_deactivated": True}

    # Validation helpers

    async def _validate_email_update(self, email: str, user_id: UUID) -> None:
        """Validate email format and uniqueness."""
        import re
        
        # Basic email format validation
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise ValueError("Invalid email format")

        # Check email uniqueness
        user_orm_service = self.dependencies["user_orm_service"]
        existing_user = await user_orm_service.get_by_email(email)
        if existing_user and existing_user.id != user_id:
            raise ValueError("Email address is already in use")

    async def _validate_username_update(self, username: str, user_id: UUID) -> None:
        """Validate username format and uniqueness."""
        # Username format validation
        if len(username) < 3 or len(username) > 50:
            raise ValueError("Username must be between 3 and 50 characters")
        
        if not username.replace('_', '').replace('-', '').isalnum():
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")

        # Check username uniqueness
        user_orm_service = self.dependencies["user_orm_service"]
        existing_user = await user_orm_service.get_by_username(username)
        if existing_user and existing_user.id != user_id:
            raise ValueError("Username is already taken")

    async def _validate_password_strength(self, password: str) -> None:
        """Validate password strength requirements."""
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")
        
        if not any(c.isupper() for c in password):
            raise ValueError("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in password):
            raise ValueError("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in password):
            raise ValueError("Password must contain at least one digit")
        
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            raise ValueError("Password must contain at least one special character")

    async def _check_password_history(self, user_id: UUID, new_password: str) -> None:
        """Check password against history to prevent reuse."""
        user_orm_service = self.dependencies["user_orm_service"]
        recent_passwords = await user_orm_service.get_recent_passwords(user_id, limit=5)

        for password_hash in recent_passwords:
            if verify_password(new_password, password_hash):
                raise ValueError("Password cannot be the same as your last 5 passwords")

    async def _validate_phone_number(self, phone: str) -> None:
        """Validate phone number format."""
        import re
        
        # Basic phone number validation (international format)
        phone_pattern = r'^\+?[1-9]\d{1,14}$'
        if not re.match(phone_pattern, phone.replace(' ', '').replace('-', '')):
            raise ValueError("Invalid phone number format")

    async def _validate_avatar_image(self, image_data: bytes, filename: str) -> None:
        """Validate avatar image."""
        # Check file size (max 5MB)
        if len(image_data) > 5 * 1024 * 1024:
            raise ValueError("Avatar image must be smaller than 5MB")

        # Check file format
        allowed_formats = ['.jpg', '.jpeg', '.png', '.gif']
        if filename and not any(filename.lower().endswith(fmt) for fmt in allowed_formats):
            raise ValueError("Avatar must be in JPG, PNG, or GIF format")

    # MFA helpers

    def _generate_totp_secret(self) -> str:
        """Generate TOTP secret key."""
        import secrets
        import base64
        
        secret_bytes = secrets.token_bytes(32)
        return base64.b32encode(secret_bytes).decode()

    def _validate_totp_code(self, secret: str, code: str) -> bool:
        """Validate TOTP code against secret."""
        # In real implementation, use proper TOTP library
        # Placeholder validation
        return len(code) == 6 and code.isdigit()

    def _generate_totp_qr_url(self, email: str, secret: str) -> str:
        """Generate QR code URL for TOTP setup."""
        import urllib.parse
        
        issuer = "NLJ Platform"
        label = urllib.parse.quote(f"{issuer}:{email}")
        
        return f"otpauth://totp/{label}?secret={secret}&issuer={urllib.parse.quote(issuer)}"

    def _validate_current_mfa_code(self, user, code: str) -> bool:
        """Validate current MFA code for user."""
        if user.mfa_method == "totp":
            return self._validate_totp_code(user.mfa_secret, code)
        elif user.mfa_method == "sms":
            # In real implementation, validate SMS code
            return len(code) == 6 and code.isdigit()
        
        return False

    def _generate_backup_codes(self) -> list[str]:
        """Generate backup codes for MFA."""
        import secrets
        
        codes = []
        for _ in range(10):  # Generate 10 backup codes
            code = f"{secrets.randbelow(100000):05d}-{secrets.randbelow(100000):05d}"
            codes.append(code)
        
        return codes

    async def _upload_avatar_file(
        self, user_id: UUID, image_data: bytes, filename: str
    ) -> str:
        """Upload avatar file and return URL."""
        # In real implementation, upload to S3 or similar storage
        # For now, return placeholder URL
        file_extension = filename.split('.')[-1] if filename else 'jpg'
        avatar_filename = f"avatar_{user_id}.{file_extension}"
        
        # Placeholder: In real app, upload to storage service
        return f"/avatars/{avatar_filename}"

    async def _publish_profile_management_event(
        self,
        response: ManageProfileResponse,
        request: ManageProfileRequest,
        user_context: Dict[str, Any]
    ) -> None:
        """Publish profile management event."""
        actor_info = self._extract_user_info(user_context)

        if request.action == ProfileAction.CHANGE_PASSWORD:
            await self._publish_event(
                "publish_user_password_changed",
                user_id=str(response.user.id),
                changed_by=actor_info["user_id"],
                changer_name=actor_info["user_name"],
                changer_email=actor_info["user_email"],
                change_timestamp=datetime.now().isoformat()
            )
        
        elif request.action == ProfileAction.SETUP_MFA:
            await self._publish_event(
                "publish_user_mfa_enabled",
                user_id=str(response.user.id),
                mfa_method=request.mfa_method.value if request.mfa_method else None,
                enabled_by=actor_info["user_id"],
                enabler_name=actor_info["user_name"],
                enabler_email=actor_info["user_email"],
                setup_timestamp=datetime.now().isoformat()
            )
        
        elif request.action == ProfileAction.DISABLE_MFA:
            await self._publish_event(
                "publish_user_mfa_disabled",
                user_id=str(response.user.id),
                disabled_by=actor_info["user_id"],
                disabler_name=actor_info["user_name"],
                disabler_email=actor_info["user_email"],
                disable_timestamp=datetime.now().isoformat()
            )
        
        else:
            # General profile update event
            await self._publish_event(
                "publish_user_profile_updated",
                user_id=str(response.user.id),
                action=request.action.value,
                updated_by=actor_info["user_id"],
                updater_name=actor_info["user_name"],
                updater_email=actor_info["user_email"],
                update_timestamp=datetime.now().isoformat()
            )

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error