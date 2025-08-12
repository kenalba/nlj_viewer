"""
Ralph LRS Service for xAPI Statement Management.
Integrates with Ralph Learning Record Store for standards-compliant xAPI storage.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class RalphLRSService:
    """Service for integrating with Ralph LRS (Learning Record Store)"""

    def __init__(self):
        self.base_url = settings.RALPH_LRS_URL or "http://ralph-lrs:8100"
        self.auth = (
            settings.RALPH_LRS_USERNAME or "nlj-platform",
            settings.RALPH_LRS_SECRET or "nlj-secure-secret-2024",
        )
        self.headers = {"X-Experience-API-Version": "1.0.3", "Content-Type": "application/json"}
        self._client = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async HTTP client"""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0, auth=self.auth, headers=self.headers)
        return self._client

    async def close(self):
        """Close the HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None

    # ========================================================================
    # STATEMENT STORAGE METHODS
    # ========================================================================

    async def store_statement(self, statement: Dict[str, Any]) -> Dict[str, Any]:
        """Store a single xAPI statement in Ralph LRS"""
        client = await self._get_client()

        try:
            # Ensure statement has required fields
            if "id" not in statement:
                statement["id"] = str(uuid4())

            if "timestamp" not in statement:
                statement["timestamp"] = datetime.now(timezone.utc).isoformat()

            if "version" not in statement:
                statement["version"] = "1.0.3"

            response = await client.post(f"{self.base_url}/xAPI/statements", json=statement)
            response.raise_for_status()

            # Ralph LRS returns statement IDs in response
            result = response.json() if response.content else {}
            logger.info(f"Stored xAPI statement {statement.get('id')} in Ralph LRS")

            return {
                "success": True,
                "statement_id": statement.get("id"),
                "stored_at": datetime.now(timezone.utc).isoformat(),
                "response": result,
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"Failed to store statement in Ralph LRS: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Error storing statement in Ralph LRS: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def store_statements(self, statements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Store multiple xAPI statements in Ralph LRS"""
        client = await self._get_client()

        try:
            # Process each statement
            processed_statements = []
            for statement in statements:
                if "id" not in statement:
                    statement["id"] = str(uuid4())

                if "timestamp" not in statement:
                    statement["timestamp"] = datetime.now(timezone.utc).isoformat()

                if "version" not in statement:
                    statement["version"] = "1.0.3"

                processed_statements.append(statement)

            response = await client.post(f"{self.base_url}/xAPI/statements", json=processed_statements)
            response.raise_for_status()

            result = response.json() if response.content else {}
            statement_ids = [stmt.get("id") for stmt in processed_statements]

            logger.info(f"Stored {len(processed_statements)} xAPI statements in Ralph LRS: {statement_ids}")

            return {
                "success": True,
                "statement_count": len(processed_statements),
                "statement_ids": statement_ids,
                "stored_at": datetime.now(timezone.utc).isoformat(),
                "response": result,
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"Failed to store statements in Ralph LRS: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Error storing statements in Ralph LRS: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    # ========================================================================
    # STATEMENT RETRIEVAL METHODS
    # ========================================================================

    async def get_statement(self, statement_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific xAPI statement by ID"""
        client = await self._get_client()

        try:
            response = await client.get(f"{self.base_url}/xAPI/statements", params={"statementId": statement_id})
            response.raise_for_status()

            if response.status_code == 200:
                result = response.json()
                logger.debug(f"Retrieved xAPI statement {statement_id}")
                return result

            return None

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"Statement {statement_id} not found")
                return None

            error_msg = f"Failed to retrieve statement {statement_id}: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Error retrieving statement {statement_id}: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def get_statements(
        self,
        agent: Optional[str] = None,
        verb: Optional[str] = None,
        activity: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: Optional[int] = None,
        format: str = "exact",
    ) -> Dict[str, Any]:
        """Retrieve xAPI statements with query parameters"""
        client = await self._get_client()

        try:
            params = {}
            if agent:
                params["agent"] = agent
            if verb:
                params["verb"] = verb
            if activity:
                params["activity"] = activity
            if since:
                params["since"] = since
            if until:
                params["until"] = until
            if limit:
                params["limit"] = str(limit)
            if format:
                params["format"] = format

            response = await client.get(f"{self.base_url}/xAPI/statements", params=params)
            response.raise_for_status()

            result = response.json()
            statement_count = len(result.get("statements", []))

            logger.debug(f"Retrieved {statement_count} xAPI statements with filters: {params}")

            return result

        except httpx.HTTPStatusError as e:
            error_msg = f"Failed to retrieve statements: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Error retrieving statements: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def get_learner_statements(
        self, learner_email: str, since: Optional[str] = None, limit: Optional[int] = 100
    ) -> List[Dict[str, Any]]:
        """Get all statements for a specific learner by email"""
        try:
            agent_json = json.dumps({"mbox": f"mailto:{learner_email}"})

            result = await self.get_statements(agent=agent_json, since=since, limit=limit)

            statements = result.get("statements", [])
            logger.debug(f"Retrieved {len(statements)} statements for learner {learner_email}")

            return statements

        except Exception as e:
            logger.error(f"Error retrieving statements for learner {learner_email}: {str(e)}")
            raise

    async def get_activity_statements(
        self,
        activity_id: str,
        since: Optional[str] = None,
        limit: Optional[int] = 100,
        verb_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get all statements for a specific activity with optional verb filtering"""
        try:
            # If verb_filter is provided, we need to make separate requests for each verb
            if verb_filter:
                all_statements = []
                verbs = [verb.strip() for verb in verb_filter.split(",")]

                for verb in verbs:
                    # Map common verb names to full URIs
                    verb_uris = {
                        "responded": "http://adlnet.gov/expapi/verbs/responded",
                        "completed": "http://adlnet.gov/expapi/verbs/completed",
                        "experienced": "http://adlnet.gov/expapi/verbs/experienced",
                        "attempted": "http://adlnet.gov/expapi/verbs/attempted",
                    }

                    verb_uri = verb_uris.get(verb, verb)

                    result = await self.get_statements(activity=activity_id, verb=verb_uri, since=since, limit=limit)

                    all_statements.extend(result.get("statements", []))

                # Remove duplicates and sort by timestamp
                seen_ids = set()
                unique_statements = []
                for stmt in all_statements:
                    stmt_id = stmt.get("id")
                    if stmt_id and stmt_id not in seen_ids:
                        seen_ids.add(stmt_id)
                        unique_statements.append(stmt)

                # Sort by timestamp (newest first)
                unique_statements.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

                statements = unique_statements[:limit] if limit else unique_statements

            else:
                result = await self.get_statements(activity=activity_id, since=since, limit=limit)

                statements = result.get("statements", [])

            logger.debug(f"Retrieved {len(statements)} statements for activity {activity_id}")

            return statements

        except Exception as e:
            logger.error(f"Error retrieving statements for activity {activity_id}: {str(e)}")
            raise

    # ========================================================================
    # SURVEY-SPECIFIC METHODS
    # ========================================================================

    async def get_survey_statistics(self, survey_id: str, since: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive statistics for a survey"""
        try:
            # Get all survey-related statements
            statements = await self.get_activity_statements(
                activity_id=survey_id, since=since, verb_filter="responded,completed", limit=1000
            )

            # Analyze survey responses
            response_statements = [
                s for s in statements if s.get("verb", {}).get("id") == "http://adlnet.gov/expapi/verbs/responded"
            ]
            completion_statements = [
                s for s in statements if s.get("verb", {}).get("id") == "http://adlnet.gov/expapi/verbs/completed"
            ]

            # Extract unique respondents
            respondent_emails = set()
            for stmt in statements:
                actor = stmt.get("actor", {})
                if actor.get("mbox"):
                    respondent_emails.add(actor["mbox"])

            # Calculate response times from completion statements
            completion_times = []
            for stmt in completion_statements:
                result = stmt.get("result", {})
                if "duration" in result:
                    # Parse ISO 8601 duration - simplified parsing
                    duration_str = result["duration"]
                    try:
                        # Basic ISO 8601 duration parsing (PT###S format)
                        if duration_str.startswith("PT") and duration_str.endswith("S"):
                            seconds = float(duration_str[2:-1])
                            completion_times.append(seconds / 60)  # Convert to minutes
                    except ValueError:
                        pass

            # Find timestamps
            timestamps = [
                datetime.fromisoformat(s.get("timestamp", "").replace("Z", "+00:00"))
                for s in statements
                if s.get("timestamp")
            ]

            last_response_at = max(timestamps).isoformat() if timestamps else None

            # Calculate statistics
            unique_respondent_count = len(respondent_emails)
            completion_rate = (
                (len(completion_statements) / unique_respondent_count * 100) if unique_respondent_count > 0 else 0
            )
            avg_completion_time = sum(completion_times) / len(completion_times) if completion_times else 0

            return {
                "total_responses": len(response_statements),
                "unique_respondents": unique_respondent_count,
                "completion_rate": round(completion_rate, 2),
                "average_completion_time": round(avg_completion_time, 1),
                "last_response_at": last_response_at,
                "response_distribution": {
                    "responses": len(response_statements),
                    "completions": len(completion_statements),
                    "partial": (
                        unique_respondent_count - len(completion_statements)
                        if unique_respondent_count > len(completion_statements)
                        else 0
                    ),
                },
            }

        except Exception as e:
            logger.warning(
                f"Unable to retrieve survey statistics for {survey_id} - Ralph LRS may not be available: {str(e)}"
            )
            # Return empty statistics when Ralph LRS is not available
            return {
                "total_responses": 0,
                "unique_respondents": 0,
                "completion_rate": 0.0,
                "average_completion_time": 0.0,
                "last_response_at": None,
                "response_distribution": {"responses": 0, "completions": 0, "partial": 0},
            }

    async def get_survey_responses_with_followup(
        self, survey_id: str, since: Optional[str] = None, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get survey responses including follow-up text from extensions"""
        try:
            statements = await self.get_activity_statements(
                activity_id=survey_id, since=since, verb_filter="responded", limit=limit
            )

            responses = []
            for stmt in statements:
                actor = stmt.get("actor", {})
                result = stmt.get("result", {})
                object_data = stmt.get("object", {})

                # Extract respondent info
                respondent_id = actor.get("mbox", "anonymous")
                if respondent_id.startswith("mailto:"):
                    respondent_id = respondent_id[7:]

                # Build response data
                response_data = {
                    "statement_id": stmt.get("id"),
                    "respondent_id": respondent_id,
                    "question_id": (
                        object_data.get("id", "").split("#")[-1] if "#" in object_data.get("id", "") else "unknown"
                    ),
                    "response_value": result.get("response"),
                    "timestamp": stmt.get("timestamp"),
                    "raw_score": result.get("score", {}).get("raw") if result.get("score") else None,
                    "success": result.get("success"),
                }

                # Extract follow-up response from extensions
                extensions = result.get("extensions", {})
                follow_up_keys = [
                    "http://nlj.platform/extensions/follow_up_response",
                    "http://adlnet.gov/expapi/extensions/followup_response",
                ]

                for key in follow_up_keys:
                    if key in extensions:
                        response_data["follow_up_response"] = extensions[key]
                        break

                # Extract question type from extensions
                question_type_keys = [
                    "http://nlj.platform/extensions/question_type",
                    "http://adlnet.gov/expapi/extensions/question_type",
                ]

                for key in question_type_keys:
                    if key in extensions:
                        response_data["question_type"] = extensions[key]
                        break

                responses.append(response_data)

            return responses

        except Exception as e:
            logger.warning(
                f"Unable to retrieve survey responses for {survey_id} - Ralph LRS may not be available: {str(e)}"
            )
            # Return empty responses when Ralph LRS is not available
            return []

    # ========================================================================
    # ANALYTICS METHODS
    # ========================================================================

    async def get_completion_stats(
        self, activity_id: Optional[str] = None, since: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get completion statistics for activities"""
        try:
            # Get all statements for the activity or all activities
            if activity_id:
                statements = await self.get_activity_statements(activity_id, since)
            else:
                result = await self.get_statements(since=since, limit=1000)
                statements = result.get("statements", [])

            # Analyze completion rates
            total_statements = len(statements)
            completed_statements = 0
            unique_learners = set()

            for stmt in statements:
                # Check if this is a completion statement
                verb_id = stmt.get("verb", {}).get("id", "")
                result_data = stmt.get("result", {})

                if verb_id == "http://adlnet.gov/expapi/verbs/completed" or result_data.get("completion") is True:
                    completed_statements += 1

                # Track unique learners
                actor = stmt.get("actor", {})
                if actor.get("mbox"):
                    unique_learners.add(actor["mbox"])

            completion_rate = (completed_statements / total_statements * 100) if total_statements > 0 else 0

            stats = {
                "total_statements": total_statements,
                "completed_statements": completed_statements,
                "completion_rate": round(completion_rate, 2),
                "unique_learners": len(unique_learners),
                "activity_id": activity_id,
                "since": since,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

            logger.debug(f"Generated completion stats: {stats}")
            return stats

        except Exception as e:
            logger.error(f"Error generating completion stats: {str(e)}")
            raise

    # ========================================================================
    # HEALTH AND UTILITY METHODS
    # ========================================================================

    async def test_connection(self) -> Dict[str, Any]:
        """Test connection to Ralph LRS"""
        client = await self._get_client()

        try:
            response = await client.get(f"{self.base_url}/__heartbeat__")
            response.raise_for_status()

            about_data = response.json()

            return {
                "success": True,
                "status": "connected",
                "ralph_version": about_data.get("version", "unknown"),
                "xapi_version": about_data.get("X-Experience-API-Version", "1.0.3"),
                "endpoint": self.base_url,
                "tested_at": datetime.now(timezone.utc).isoformat(),
            }

        except httpx.HTTPStatusError as e:
            error_msg = f"Ralph LRS connection failed: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            return {
                "success": False,
                "status": "connection_failed",
                "error": error_msg,
                "endpoint": self.base_url,
                "tested_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            error_msg = f"Ralph LRS connection error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "status": "error",
                "error": error_msg,
                "endpoint": self.base_url,
                "tested_at": datetime.now(timezone.utc).isoformat(),
            }

    async def get_about_info(self) -> Dict[str, Any]:
        """Get Ralph LRS about information"""
        client = await self._get_client()

        try:
            response = await client.get(f"{self.base_url}/xAPI/about")
            response.raise_for_status()

            return response.json()

        except Exception as e:
            logger.error(f"Error getting Ralph LRS about info: {str(e)}")
            raise


# Global Ralph LRS service instance
ralph_lrs_service = RalphLRSService()


# Dependency injection functions for FastAPI
async def get_ralph_lrs_service() -> RalphLRSService:
    """Get Ralph LRS service instance for dependency injection"""
    return ralph_lrs_service
