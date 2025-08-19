import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.models.content import ContentItem, ContentState, ContentType, LearningStyle
from app.models.user import User, UserRole


class UserFactory:
    """Factory for creating User test instances."""
    
    @staticmethod
    def create(
        username: str = None,
        email: str = None,
        role: UserRole = UserRole.CREATOR,
        **kwargs
    ) -> User:
        # Generate unique values if not provided
        unique_id = str(uuid.uuid4())[:8]
        if username is None:
            username = f"testuser_{unique_id}"
        if email is None:
            email = f"test_{unique_id}@example.com"
            
        defaults = {
            "id": uuid.uuid4(),
            "username": username,
            "email": email,
            "hashed_password": "hashed_password_123",
            "full_name": f"Test {username.title()}",
            "role": role,
            "is_active": True,
            "is_verified": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        defaults.update(kwargs)
        return User(**defaults)


class ContentFactory:
    """Factory for creating ContentItem test instances."""
    
    @staticmethod
    def create(
        title: str = "Test Content",
        creator_id: Optional[uuid.UUID] = None,
        **kwargs
    ) -> ContentItem:
        if creator_id is None:
            creator_id = uuid.uuid4()
            
        defaults = {
            "id": uuid.uuid4(),
            "title": title,
            "description": f"Description for {title}",
            "content_type": ContentType.TRAINING,
            "nlj_data": {"nodes": [], "edges": []},
            "learning_style": LearningStyle.VISUAL,
            "is_template": False,
            "template_category": None,
            "state": ContentState.DRAFT,
            "version": 1,
            "view_count": 0,
            "completion_count": 0,
            "created_by": creator_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        defaults.update(kwargs)
        return ContentItem(**defaults)


class TestDataBuilder:
    """Builder pattern for creating complex test data scenarios."""
    
    def __init__(self):
        self.users = []
        self.content_items = []
    
    def with_users(self, count: int = 1, role: UserRole = UserRole.CREATOR) -> "TestDataBuilder":
        """Add users to the test data."""
        for i in range(count):
            # Let UserFactory generate unique usernames and emails
            user = UserFactory.create(role=role)
            self.users.append(user)
        return self
    
    def with_content(self, count: int = 1, creator_index: int = 0) -> "TestDataBuilder":
        """Add content items to the test data."""
        if not self.users:
            raise ValueError("Must add users before content")
            
        creator = self.users[creator_index]
        for i in range(count):
            content = ContentFactory.create(
                title=f"Test Content {i+1}",
                creator_id=creator.id
            )
            self.content_items.append(content)
        return self
    
    def build(self) -> Dict[str, Any]:
        """Build the test data dictionary."""
        return {
            "users": self.users,
            "content_items": self.content_items
        }