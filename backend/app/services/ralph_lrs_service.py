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

# ElasticSearch fallback for when Ralph LRS filtering fails
try:
    from elasticsearch import AsyncElasticsearch
    from elasticsearch.exceptions import ConnectionError as ESConnectionError
    ELASTICSEARCH_AVAILABLE = True
except ImportError:
    ELASTICSEARCH_AVAILABLE = False
    AsyncElasticsearch = None
    ESConnectionError = Exception

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
        
        # ElasticSearch fallback for when Ralph LRS filtering fails
        self._es_client = None
        if ELASTICSEARCH_AVAILABLE:
            es_url = getattr(settings, 'ELASTICSEARCH_URL', 'http://elasticsearch:9200')
            self._es_client = AsyncElasticsearch([es_url])

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
        if self._es_client:
            await self._es_client.close()
            self._es_client = None

    # ========================================================================
    # ELASTICSEARCH FALLBACK METHODS
    # ========================================================================
    
    async def _query_elasticsearch_statements(
        self,
        activity_id: Optional[str] = None,
        verb: Optional[str] = None,
        agent_email: Optional[str] = None,
        since: Optional[str] = None,
        limit: Optional[int] = 100,
    ) -> List[Dict[str, Any]]:
        """
        Query ElasticSearch directly for statements when Ralph LRS filtering fails.
        Returns statements in xAPI format compatible with Ralph LRS.
        """
        if not self._es_client:
            logger.warning("ElasticSearch not available for fallback queries")
            return []

        try:
            # Build ElasticSearch query
            query = {"bool": {"must": []}}
            
            if activity_id:
                query["bool"]["must"].append({"term": {"object.id": activity_id}})
                
            if verb:
                query["bool"]["must"].append({"term": {"verb.id": verb}})
                
            if agent_email:
                query["bool"]["must"].append({"term": {"actor.mbox": f"mailto:{agent_email}"}})
                
            if since:
                query["bool"]["must"].append({"range": {"timestamp": {"gte": since}}})
            
            # If no filters, get all statements
            if not query["bool"]["must"]:
                query = {"match_all": {}}

            # Execute search
            response = await self._es_client.search(
                index="statements",
                query=query,
                size=limit or 100,
                sort=[{"timestamp": {"order": "desc"}}]
            )
            
            # Extract statements from ElasticSearch response
            statements = []
            for hit in response["hits"]["hits"]:
                statements.append(hit["_source"])
                
            logger.info(f"ElasticSearch fallback retrieved {len(statements)} statements")
            return statements
            
        except Exception as e:
            logger.error(f"ElasticSearch fallback query failed: {e}")
            return []

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
            # Try Ralph LRS first for xAPI compliance
            if verb_filter:
                all_statements = []
                verbs = [verb.strip() for verb in verb_filter.split(",")]

                for verb in verbs:
                    # Map common verb names to full URIs
                    verb_uris = {
                        "responded": "http://adlnet.gov/expapi/verbs/responded",
                        "answered": "http://adlnet.gov/expapi/verbs/answered",
                        "completed": "http://adlnet.gov/expapi/verbs/completed",
                        "started": "http://activitystrea.ms/schema/1.0/start",
                        "experienced": "http://adlnet.gov/expapi/verbs/experienced",
                        "attempted": "http://adlnet.gov/expapi/verbs/attempted",
                    }

                    verb_uri = verb_uris.get(verb, verb)

                    try:
                        result = await self.get_statements(activity=activity_id, verb=verb_uri, since=since, limit=limit)
                        ralph_statements = result.get("statements", [])
                        
                        # Check if Ralph LRS returned empty results - this might indicate silent filtering failure
                        if not ralph_statements:
                            # Try ElasticSearch to see if data exists
                            fallback_statements = await self._query_elasticsearch_statements(
                                activity_id=activity_id, verb=verb_uri, since=since, limit=limit
                            )
                            if fallback_statements:
                                logger.warning(f"Ralph LRS returned empty results for verb {verb}, but ElasticSearch found {len(fallback_statements)} statements. Using ElasticSearch data.")
                                all_statements.extend(fallback_statements)
                            else:
                                # Both returned empty, probably no data exists
                                logger.debug(f"No statements found for verb {verb} in both Ralph LRS and ElasticSearch")
                        else:
                            all_statements.extend(ralph_statements)
                            
                    except Exception as e:
                        # Ralph LRS filtering failed with error, use ElasticSearch fallback
                        logger.warning(f"Ralph LRS filtering failed for verb {verb} with error: {e}, using ElasticSearch fallback")
                        fallback_statements = await self._query_elasticsearch_statements(
                            activity_id=activity_id, verb=verb_uri, since=since, limit=limit
                        )
                        all_statements.extend(fallback_statements)

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
                try:
                    result = await self.get_statements(activity=activity_id, since=since, limit=limit)
                    ralph_statements = result.get("statements", [])
                    
                    # Check if Ralph LRS returned empty results
                    if not ralph_statements:
                        # Try ElasticSearch to see if data exists
                        fallback_statements = await self._query_elasticsearch_statements(
                            activity_id=activity_id, since=since, limit=limit
                        )
                        if fallback_statements:
                            logger.warning(f"Ralph LRS returned empty results for activity {activity_id}, but ElasticSearch found {len(fallback_statements)} statements. Using ElasticSearch data.")
                            statements = fallback_statements
                        else:
                            logger.debug(f"No statements found for activity {activity_id} in both Ralph LRS and ElasticSearch")
                            statements = []
                    else:
                        statements = ralph_statements
                        
                except Exception as e:
                    # Ralph LRS filtering failed with error, use ElasticSearch fallback
                    logger.warning(f"Ralph LRS filtering failed for activity {activity_id} with error: {e}, using ElasticSearch fallback")
                    statements = await self._query_elasticsearch_statements(
                        activity_id=activity_id, since=since, limit=limit
                    )

            logger.debug(f"Retrieved {len(statements)} statements for activity {activity_id}")
            return statements

        except Exception as e:
            logger.error(f"Error retrieving statements for activity {activity_id}: {str(e)}")
            # Final fallback to ElasticSearch
            logger.warning("Falling back to ElasticSearch for activity statements")
            return await self._query_elasticsearch_statements(
                activity_id=activity_id, since=since, limit=limit
            )

    # ========================================================================
    # SURVEY ANALYTICS METHODS (ELASTICSEARCH-FIRST)
    # ========================================================================

    async def get_survey_analytics(
        self,
        survey_id: str,
        question_id: Optional[str] = None,
        group_by: Optional[str] = None,
        since: Optional[str] = None,
        limit: int = 10000,
    ) -> Dict[str, Any]:
        """
        Get comprehensive survey analytics with question-type-specific aggregations.
        Uses ElasticSearch directly for reliable filtering and aggregations.
        """
        if not self._es_client:
            logger.error("ElasticSearch client not available for survey analytics")
            return {"error": "Analytics service unavailable", "success": False}

        try:
            # Build base query for survey responses
            # Survey questions are stored with parent_survey extension, not in the object ID
            # Handle both UUID-only format and full URL format
            query = {
                "bool": {
                    "must": [
                        {"term": {"verb.id.keyword": "http://adlnet.gov/expapi/verbs/answered"}},
                        {
                            "bool": {
                                "should": [
                                    {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": survey_id}},
                                    {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": f"http://nlj.platform/content/{survey_id}"}}
                                ],
                                "minimum_should_match": 1
                            }
                        }
                    ]
                }
            }
            
            # Add time filter if specified
            if since:
                query["bool"]["must"].append({"range": {"timestamp": {"gte": since}}})
            
            # Add question filter if specified
            if question_id:
                query["bool"]["must"].append({
                    "term": {"object.id.keyword": f"http://nlj.platform/questions/{question_id}"}
                })
            
            # Build aggregations for response analysis
            aggs = {
                # Response value distribution
                "response_distribution": {
                    "terms": {
                        "field": "result.response.keyword",
                        "size": 50,
                        "missing": "no_response"
                    }
                },
                
                # Question breakdown
                "questions": {
                    "terms": {
                        "field": "object.id.keyword",
                        "size": 100
                    },
                    "aggs": {
                        "responses": {
                            "terms": {
                                "field": "result.response.keyword",
                                "size": 20
                            }
                        },
                        "avg_score": {
                            "avg": {
                                "field": "result.score.scaled",
                                "missing": 0
                            }
                        },
                        "question_type": {
                            "terms": {
                                "field": "context.extensions.http://nlj.platform/extensions/question_type.keyword",
                                "size": 20
                            }
                        }
                    }
                },
                
                # Respondent demographics
                "demographics": {
                    "terms": {
                        "field": "actor.mbox.keyword",
                        "size": 1000
                    }
                },
                
                # Time-based trends
                "timeline": {
                    "date_histogram": {
                        "field": "timestamp",
                        "calendar_interval": "1d",
                        "min_doc_count": 1
                    },
                    "aggs": {
                        "unique_respondents": {
                            "cardinality": {
                                "field": "actor.mbox.keyword"
                            }
                        }
                    }
                }
            }
            
            # Add demographic grouping if specified
            if group_by:
                demographic_field = f"context.extensions.http://nlj.platform/extensions/{group_by}.keyword"
                aggs["demographic_breakdown"] = {
                    "terms": {
                        "field": demographic_field,
                        "size": 50,
                        "missing": "not_specified"
                    },
                    "aggs": {
                        "responses": {
                            "terms": {
                                "field": "result.response.keyword",
                                "size": 20
                            }
                        },
                        "avg_score": {
                            "avg": {
                                "field": "result.score.scaled"
                            }
                        },
                        "unique_respondents": {
                            "cardinality": {
                                "field": "actor.mbox.keyword"
                            }
                        }
                    }
                }
            
            # Execute search
            response = await self._es_client.search(
                index="statements",
                query=query,
                aggs=aggs,
                size=0  # Only need aggregations
            )
            
            # Transform aggregation results
            analytics_data = self._transform_survey_aggregations(
                response["aggregations"], survey_id, question_id, group_by
            )
            
            logger.info(f"Generated survey analytics for {survey_id}, found {response['hits']['total']['value']} responses")
            
            return {
                "success": True,
                "survey_id": survey_id,
                "question_id": question_id,
                "group_by": group_by,
                "data": analytics_data,
                "total_responses": response["hits"]["total"]["value"],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error generating survey analytics for {survey_id}: {str(e)}")
            return {"error": str(e), "success": False}

    def _transform_survey_aggregations(
        self, 
        aggregations: Dict[str, Any], 
        survey_id: str,
        question_id: Optional[str] = None,
        group_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transform ElasticSearch aggregation results into analytics format"""
        
        # Extract response distribution
        response_dist = aggregations.get("response_distribution", {})
        response_buckets = response_dist.get("buckets", [])
        
        overall_distribution = {}
        for bucket in response_buckets:
            response_value = bucket["key"]
            count = bucket["doc_count"]
            overall_distribution[response_value] = count
        
        # Extract question-level analytics
        questions_agg = aggregations.get("questions", {})
        question_buckets = questions_agg.get("buckets", [])
        
        question_analytics = {}
        for bucket in question_buckets:
            question_uri = bucket["key"]
            # Extract question ID from URI like "http://nlj.platform/questions/q028"
            question_key = question_uri.split("/")[-1] if "/" in question_uri else question_uri
            
            # Extract response distribution for this question
            question_responses = {}
            for resp_bucket in bucket.get("responses", {}).get("buckets", []):
                question_responses[resp_bucket["key"]] = resp_bucket["doc_count"]
            
            # Get question type
            question_type = "unknown"
            type_buckets = bucket.get("question_type", {}).get("buckets", [])
            if type_buckets:
                question_type = type_buckets[0]["key"]
            
            question_analytics[question_key] = {
                "response_count": bucket["doc_count"],
                "response_distribution": question_responses,
                "average_score": bucket.get("avg_score", {}).get("value"),
                "question_type": question_type
            }
        
        # Extract demographic breakdown if requested
        demographic_data = {}
        if group_by and "demographic_breakdown" in aggregations:
            demo_buckets = aggregations["demographic_breakdown"].get("buckets", [])
            
            for bucket in demo_buckets:
                group_name = bucket["key"]
                group_responses = {}
                
                for resp_bucket in bucket.get("responses", {}).get("buckets", []):
                    group_responses[resp_bucket["key"]] = resp_bucket["doc_count"]
                
                demographic_data[group_name] = {
                    "total_responses": bucket["doc_count"],
                    "response_distribution": group_responses,
                    "average_score": bucket.get("avg_score", {}).get("value"),
                    "unique_respondents": bucket.get("unique_respondents", {}).get("value", 0)
                }
        
        # Extract timeline data
        timeline_buckets = aggregations.get("timeline", {}).get("buckets", [])
        timeline_data = []
        for bucket in timeline_buckets:
            timeline_data.append({
                "date": bucket["key_as_string"],
                "responses": bucket["doc_count"],
                "unique_respondents": bucket.get("unique_respondents", {}).get("value", 0)
            })
        
        # Calculate unique respondents
        unique_respondents = aggregations.get("demographics", {}).get("buckets", [])
        respondent_count = len(unique_respondents)
        
        return {
            "overview": {
                "unique_respondents": respondent_count,
                "response_distribution": overall_distribution,
                "response_rate": self._calculate_response_rate(overall_distribution, respondent_count)
            },
            "questions": question_analytics,
            "demographics": demographic_data if group_by else {},
            "timeline": timeline_data,
            "demographic_grouping": group_by
        }
    
    def _calculate_response_rate(self, distribution: Dict[str, int], respondent_count: int) -> float:
        """Calculate response rate as percentage"""
        total_responses = sum(distribution.values())
        if respondent_count == 0:
            return 0.0
        return round((total_responses / respondent_count) * 100, 2)

    async def get_survey_question_analytics(
        self,
        survey_id: str,
        question_id: str,
        scale_type: str = "likert",
        since: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed analytics for a specific survey question with scale-aware processing.
        Optimized for different question types (Likert, NPS, Rating, Binary, etc.)
        """
        if not self._es_client:
            logger.error("ElasticSearch client not available for question analytics")
            return {"error": "Analytics service unavailable", "success": False}

        try:
            # Build question-specific query
            # Handle both UUID-only format and full URL format for parent_survey
            query = {
                "bool": {
                    "must": [
                        {"term": {"verb.id.keyword": "http://adlnet.gov/expapi/verbs/answered"}},
                        {
                            "bool": {
                                "should": [
                                    {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": survey_id}},
                                    {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": f"http://nlj.platform/content/{survey_id}"}}
                                ],
                                "minimum_should_match": 1
                            }
                        },
                        {"term": {"object.id.keyword": f"http://nlj.platform/questions/{question_id}"}}
                    ]
                }
            }
            
            if since:
                query["bool"]["must"].append({"range": {"timestamp": {"gte": since}}})
            
            # Build scale-specific aggregations
            aggs = self._build_scale_specific_aggregations(scale_type)
            
            # Execute search
            response = await self._es_client.search(
                index="statements",
                query=query,
                aggs=aggs,
                size=100  # Get some raw responses for analysis
            )
            
            # Process results based on scale type
            analytics = self._process_question_analytics(
                response, scale_type, survey_id, question_id
            )
            
            logger.info(f"Generated question analytics for {survey_id}#{question_id}")
            
            return {
                "success": True,
                "survey_id": survey_id,
                "question_id": question_id,
                "scale_type": scale_type,
                "data": analytics,
                "total_responses": response["hits"]["total"]["value"],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Error generating question analytics for {survey_id}#{question_id}: {str(e)}")
            return {"error": str(e), "success": False}

    def _build_scale_specific_aggregations(self, scale_type: str) -> Dict[str, Any]:
        """Build aggregations optimized for specific question scale types"""
        base_aggs = {
            "response_distribution": {
                "terms": {
                    "field": "result.response.keyword",
                    "size": 50
                }
            },
            "score_stats": {
                "stats": {
                    "field": "result.score.scaled"
                }
            },
            "unique_respondents": {
                "cardinality": {
                    "field": "actor.mbox.keyword"
                }
            }
        }
        
        # Add scale-specific aggregations
        if scale_type in ["likert", "nps", "rating"]:
            # Numeric scale analysis
            base_aggs.update({
                "score_histogram": {
                    "histogram": {
                        "field": "result.score.scaled",
                        "interval": 1,
                        "min_doc_count": 1
                    }
                },
                "positive_responses": {
                    "range": {
                        "field": "result.score.scaled",
                        "ranges": [
                            {"from": 4, "key": "positive"},  # 4+ for Likert
                            {"from": 0, "to": 4, "key": "negative"}
                        ] if scale_type == "likert" else [
                            {"from": 9, "key": "promoters"},  # NPS promoters
                            {"from": 7, "to": 9, "key": "passives"},  # NPS passives 
                            {"from": 0, "to": 7, "key": "detractors"}  # NPS detractors
                        ]
                    }
                }
            })
        
        elif scale_type == "binary":
            # Binary analysis (True/False, Yes/No)
            base_aggs.update({
                "binary_split": {
                    "terms": {
                        "field": "result.success",
                        "size": 2
                    }
                }
            })
        
        elif scale_type == "matrix":
            # Matrix question analysis
            base_aggs.update({
                "matrix_responses": {
                    "nested": {
                        "path": "result.extensions.matrix_responses"
                    },
                    "aggs": {
                        "by_row": {
                            "terms": {
                                "field": "result.extensions.matrix_responses.row.keyword",
                                "size": 20
                            },
                            "aggs": {
                                "by_column": {
                                    "terms": {
                                        "field": "result.extensions.matrix_responses.column.keyword",
                                        "size": 10
                                    }
                                }
                            }
                        }
                    }
                }
            })
        
        return base_aggs

    def _process_question_analytics(
        self, 
        response: Dict[str, Any],
        scale_type: str,
        survey_id: str,
        question_id: str
    ) -> Dict[str, Any]:
        """Process ElasticSearch response into question analytics"""
        
        aggregations = response.get("aggregations", {})
        hits = response.get("hits", {})
        
        # Base analytics
        analytics = {
            "response_count": hits["total"]["value"],
            "unique_respondents": aggregations.get("unique_respondents", {}).get("value", 0),
            "response_distribution": {},
            "statistical_summary": {},
            "scale_analysis": {}
        }
        
        # Response distribution
        dist_buckets = aggregations.get("response_distribution", {}).get("buckets", [])
        for bucket in dist_buckets:
            analytics["response_distribution"][bucket["key"]] = bucket["doc_count"]
        
        # Statistical summary
        score_stats = aggregations.get("score_stats", {})
        if score_stats:
            analytics["statistical_summary"] = {
                "mean": round(score_stats.get("avg", 0), 2),
                "min": score_stats.get("min"),
                "max": score_stats.get("max"),
                "count": score_stats.get("count", 0)
            }
        
        # Scale-specific analysis
        if scale_type in ["likert", "rating"]:
            positive_ranges = aggregations.get("positive_responses", {}).get("buckets", [])
            for bucket in positive_ranges:
                analytics["scale_analysis"][bucket["key"]] = bucket["doc_count"]
                
        elif scale_type == "nps":
            nps_ranges = aggregations.get("positive_responses", {}).get("buckets", [])
            nps_data = {"promoters": 0, "passives": 0, "detractors": 0}
            for bucket in nps_ranges:
                nps_data[bucket["key"]] = bucket["doc_count"]
            
            # Calculate NPS score
            total = sum(nps_data.values())
            if total > 0:
                nps_score = ((nps_data["promoters"] - nps_data["detractors"]) / total) * 100
                analytics["scale_analysis"] = {
                    **nps_data,
                    "nps_score": round(nps_score, 1)
                }
            else:
                analytics["scale_analysis"] = {
                    **nps_data,
                    "nps_score": 0.0
                }
        
        elif scale_type == "binary":
            binary_buckets = aggregations.get("binary_split", {}).get("buckets", [])
            for bucket in binary_buckets:
                key = "positive" if bucket["key"] else "negative"
                analytics["scale_analysis"][key] = bucket["doc_count"]
        
        # Add sample responses for qualitative analysis
        sample_responses = []
        for hit in hits.get("hits", [])[:5]:  # First 5 responses
            source = hit["_source"]
            sample_responses.append({
                "respondent": source.get("actor", {}).get("mbox", "anonymous"),
                "response": source.get("result", {}).get("response"),
                "score": source.get("result", {}).get("score", {}).get("raw"),
                "timestamp": source.get("timestamp")
            })
        
        analytics["sample_responses"] = sample_responses
        
        return analytics

    # ========================================================================
    # SURVEY-SPECIFIC METHODS (LEGACY - MAINTAINED FOR COMPATIBILITY)
    # ========================================================================

    async def get_survey_statistics(self, survey_id: str, since: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive statistics for a survey"""
        try:
            # Convert survey_id to full URI format that Ralph LRS expects
            activity_uri = f"http://nlj.platform/content/{survey_id}"
            
            # Get survey-level statements (completed, started)
            survey_statements = await self.get_activity_statements(
                activity_id=activity_uri, since=since, verb_filter="completed,started", limit=1000
            )
            
            # For question responses, we need to query ElasticSearch directly since they have different object.id
            # but reference the parent survey in context extensions
            question_statements = []
            if self._es_client:
                try:
                    query = {
                        "bool": {
                            "must": [
                                {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/answered"}},
                                {"wildcard": {"object.id": "http://nlj.platform/content/*/question/*"}}
                            ]
                        }
                    }
                    
                    if since:
                        query["bool"]["must"].append({"range": {"timestamp": {"gte": since}}})
                    
                    response = await self._es_client.search(
                        index="statements",
                        query=query,
                        size=10000,  # Large limit for all question responses
                        sort=[{"timestamp": {"order": "desc"}}]
                    )
                    
                    for hit in response["hits"]["hits"]:
                        question_statements.append(hit["_source"])
                        
                    logger.info(f"Retrieved {len(question_statements)} question response statements for survey {survey_id}")
                    
                except Exception as e:
                    logger.warning(f"Failed to retrieve question statements from ElasticSearch: {e}")
            
            # Combine all statements
            statements = survey_statements + question_statements

            # Analyze survey responses (using answered for surveys)
            response_statements = [
                s for s in statements if s.get("verb", {}).get("id") == "http://adlnet.gov/expapi/verbs/answered"
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
            # Convert survey_id to full URI format that Ralph LRS expects
            activity_uri = f"http://nlj.platform/content/{survey_id}"
            
            statements = await self.get_activity_statements(
                activity_id=activity_uri, since=since, verb_filter="answered", limit=limit
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

    async def get_survey_statements(
        self,
        survey_id: str,
        limit: int = 500,
        since: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get raw xAPI statements for a survey for demographic analysis.
        Used by demographic detector to analyze context extensions.
        """
        try:
            # Use ElasticSearch to get raw statements
            if not self._es_client:
                logger.error("ElasticSearch client not available for statement retrieval")
                return {"error": "Statement service unavailable", "success": False, "statements": []}

            # Query for survey-related statements
            query = {
                "bool": {
                    "should": [
                        # Survey completion events
                        {
                            "bool": {
                                "must": [
                                    {"term": {"verb.id": "http://adlnet.gov/expapi/verbs/completed"}},
                                    {"match": {"object.id": f"*{survey_id}*"}}
                                ]
                            }
                        },
                        # Survey question responses
                        {
                            "bool": {
                                "must": [
                                    {"term": {"verb.id.keyword": "http://adlnet.gov/expapi/verbs/answered"}},
                                    {
                                        "bool": {
                                            "should": [
                                                {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": survey_id}},
                                                {"match": {"context.extensions.http://nlj.platform/extensions/parent_survey": f"http://nlj.platform/content/{survey_id}"}}
                                            ],
                                            "minimum_should_match": 1
                                        }
                                    }
                                ]
                            }
                        }
                    ],
                    "minimum_should_match": 1
                }
            }

            # Add time filter if specified
            if since:
                query["bool"]["filter"] = [{"range": {"timestamp": {"gte": since}}}]

            # Execute search
            search_body = {
                "query": query,
                "size": limit,
                "sort": [{"timestamp": {"order": "desc"}}],
                "_source": ["actor", "verb", "object", "context", "timestamp", "stored"]
            }

            result = await self._es_client.search(
                index="statements",
                body=search_body
            )

            statements = []
            if result and "hits" in result:
                for hit in result["hits"]["hits"]:
                    statements.append(hit["_source"])

            logger.info(f"Retrieved {len(statements)} statements for survey {survey_id} demographic analysis")

            return {
                "success": True,
                "statements": statements,
                "total_found": result.get("hits", {}).get("total", {}).get("value", 0) if result else 0,
                "query_info": {
                    "survey_id": survey_id,
                    "limit": limit,
                    "since": since,
                }
            }

        except Exception as e:
            logger.error(f"Error retrieving survey statements: {e}")
            return {"error": f"Statement retrieval failed: {str(e)}", "success": False, "statements": []}


# Global Ralph LRS service instance
ralph_lrs_service = RalphLRSService()


# Dependency injection functions for FastAPI
async def get_ralph_lrs_service() -> RalphLRSService:
    """Get Ralph LRS service instance for dependency injection"""
    return ralph_lrs_service
