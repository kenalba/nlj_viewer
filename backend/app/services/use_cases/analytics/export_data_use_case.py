"""
Export Data Use Case - Data Export and Reporting Business Workflow.

Handles comprehensive data export and reporting including:
- Learning analytics data export
- Progress reports generation
- Custom report creation
- Data format conversion (CSV, Excel, JSON, PDF)
- Scheduled report automation
- Data privacy and compliance handling
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional, List, Union
from uuid import UUID
from enum import Enum
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services.orm_services.content_orm_service import ContentOrmService
from app.services.orm_services.training_orm_service import TrainingOrmService
from app.services.orm_services.user_orm_service import UserOrmService
from ..base_use_case import BaseUseCase

logger = logging.getLogger(__name__)


class ExportFormat(Enum):
    """Data export formats."""
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"
    PDF = "pdf"
    XML = "xml"


class ExportType(Enum):
    """Types of data exports."""
    LEARNING_ANALYTICS = "learning_analytics"
    PROGRESS_REPORT = "progress_report"
    ENGAGEMENT_SUMMARY = "engagement_summary"
    COMPLETION_REPORT = "completion_report"
    CUSTOM_QUERY = "custom_query"
    XAPI_STATEMENTS = "xapi_statements"
    USER_ACTIVITY = "user_activity"
    CONTENT_PERFORMANCE = "content_performance"


class PrivacyLevel(Enum):
    """Data privacy levels."""
    FULL_ACCESS = "full_access"
    ANONYMIZED = "anonymized"
    AGGREGATED_ONLY = "aggregated_only"
    RESTRICTED = "restricted"


@dataclass
class ExportDataRequest:
    """Request object for data export operations."""
    export_type: ExportType
    export_format: ExportFormat
    user_id: Optional[UUID] = None
    program_id: Optional[UUID] = None
    content_id: Optional[UUID] = None
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    privacy_level: PrivacyLevel = PrivacyLevel.AGGREGATED_ONLY
    include_pii: bool = False
    custom_query: Optional[Dict[str, Any]] = None
    report_template: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    columns: Optional[List[str]] = None
    schedule_recurring: bool = False
    notification_emails: Optional[List[str]] = None


@dataclass
class ExportDataResponse:
    """Response object for data export operations."""
    export: Dict[str, Any]  # Simplified until schema exists
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    file_size_bytes: int = 0
    records_exported: int = 0
    export_duration_ms: float = 0.0
    privacy_applied: bool = False
    scheduled_export_id: Optional[UUID] = None


class ExportDataUseCase(BaseUseCase[ExportDataRequest, ExportDataResponse]):
    """
    Use case for comprehensive data export and reporting operations.

    Responsibilities:
    - Export learning analytics and progress data
    - Generate custom reports in multiple formats
    - Apply data privacy and anonymization rules
    - Handle large dataset exports with streaming
    - Schedule recurring export operations
    - Manage export permissions and access controls

    Events Published:
    - Data export events (nlj.analytics.data_exported)
    - Report generation events (nlj.analytics.report_generated)
    - Scheduled export events (nlj.analytics.scheduled_export_created)
    - Privacy compliance events (nlj.analytics.privacy_applied)
    """

    def __init__(
        self,
        session: AsyncSession,
        content_orm_service: ContentOrmService,
        training_orm_service: TrainingOrmService,
        user_orm_service: UserOrmService
    ):
        """
        Initialize export data use case.

        Args:
            session: Database session for transaction management
            content_orm_service: Content data access
            training_orm_service: Training data access
            user_orm_service: User data access
        """
        super().__init__(
            session,
            content_orm_service=content_orm_service,
            training_orm_service=training_orm_service,
            user_orm_service=user_orm_service
        )

    async def execute(
        self,
        request: ExportDataRequest,
        user_context: Dict[str, Any]
    ) -> ExportDataResponse:
        """
        Execute data export workflow.

        Args:
            request: Data export request with parameters
            user_context: User context for permissions and events

        Returns:
            Data export response with file information

        Raises:
            PermissionError: If user lacks export permissions
            ValueError: If request validation fails
            RuntimeError: If data export fails
        """
        start_time = datetime.now()
        
        try:
            # Validate permissions
            await self._validate_export_permissions(request, user_context)

            # Validate request parameters
            await self._validate_export_request(request)

            # Extract and prepare data for export
            export_data = await self._extract_export_data(request)

            # Apply privacy and data protection rules
            processed_data, privacy_applied = await self._apply_privacy_rules(
                export_data, request.privacy_level, request.include_pii
            )

            # Generate export file
            file_path, file_size, file_url = await self._generate_export_file(
                processed_data, request
            )

            # Create export record (placeholder)
            export_record = {
                "id": "placeholder_export_id",
                "type": request.export_type.value,
                "format": request.export_format.value,
                "created_at": datetime.now().isoformat(),
                "status": "completed"
            }

            # Handle scheduled export if requested (placeholder)
            scheduled_export_id = None
            if request.schedule_recurring:
                scheduled_export_id = UUID("12345678-1234-5678-9012-123456789012")  # Placeholder
                logger.info("Scheduled export created (placeholder)")

            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            # Create response
            response = ExportDataResponse(
                export=export_record,
                file_path=file_path,
                file_url=file_url,
                file_size_bytes=file_size,
                records_exported=len(processed_data),
                export_duration_ms=processing_time,
                privacy_applied=privacy_applied,
                scheduled_export_id=scheduled_export_id
            )

            # Publish export completion event
            await self._publish_export_completion_event(
                request, response, user_context
            )

            # Send notifications if requested
            if request.notification_emails:
                await self._send_export_notifications(
                    request.notification_emails, response
                )

            logger.info(
                f"Data export completed: {request.export_type.value}, "
                f"format: {request.export_format.value}, "
                f"records: {len(processed_data)}, "
                f"size: {file_size} bytes, "
                f"time: {processing_time:.2f}ms"
            )
            return response

        except PermissionError:
            raise
        except ValueError as e:
            self._handle_validation_error(e, f"data export {request.export_type.value}")
        except Exception as e:
            await self._handle_service_error(e, f"data export {request.export_type.value}")
            raise  # This should never be reached but satisfies mypy

    async def _validate_export_permissions(
        self,
        request: ExportDataRequest,
        user_context: Dict[str, Any]
    ) -> None:
        """Validate user has permissions for data export."""
        user_role = user_context.get("user_role")
        user_id = UUID(user_context["user_id"])

        # Basic export permission - reviewers and above
        await self._validate_user_role(
            user_context,
            required_roles=[UserRole.REVIEWER, UserRole.APPROVER, UserRole.ADMIN],
            error_message="Insufficient permissions to export data"
        )

        # PII access requires admin role
        if request.include_pii and user_role != UserRole.ADMIN:
            raise PermissionError("Admin role required to export personally identifiable information")

        # Individual user data access - users can export their own data
        if request.user_id and request.user_id != user_id:
            await self._validate_user_role(
                user_context,
                required_roles=[UserRole.ADMIN],
                error_message="Admin role required to export other users' data"
            )

        # Full access privacy level requires admin
        if request.privacy_level == PrivacyLevel.FULL_ACCESS and user_role != UserRole.ADMIN:
            raise PermissionError("Admin role required for full access data export")

    async def _validate_export_request(self, request: ExportDataRequest) -> None:
        """Validate export request parameters."""
        # Validate time range
        if request.time_range_start and request.time_range_end:
            if request.time_range_start >= request.time_range_end:
                raise ValueError("Time range start must be before end")

            # Prevent excessively large time ranges
            time_diff = request.time_range_end - request.time_range_start
            if time_diff.days > 365:
                raise ValueError("Time range cannot exceed 365 days")

        # Validate custom query structure if provided
        if request.export_type == ExportType.CUSTOM_QUERY and not request.custom_query:
            raise ValueError("Custom query is required for custom query export type")

        # Validate required fields for specific export types
        if request.export_type == ExportType.PROGRESS_REPORT and not request.user_id and not request.program_id:
            raise ValueError("Progress reports require either user_id or program_id")

    async def _extract_export_data(self, request: ExportDataRequest) -> List[Dict[str, Any]]:
        """Extract data based on export type."""
        if request.export_type == ExportType.LEARNING_ANALYTICS:
            return await self._extract_learning_analytics_data(request)
        elif request.export_type == ExportType.PROGRESS_REPORT:
            return await self._extract_progress_report_data(request)
        elif request.export_type == ExportType.ENGAGEMENT_SUMMARY:
            return await self._extract_engagement_summary_data(request)
        elif request.export_type == ExportType.COMPLETION_REPORT:
            return await self._extract_completion_report_data(request)
        elif request.export_type == ExportType.CUSTOM_QUERY:
            return await self._extract_custom_query_data(request)
        elif request.export_type == ExportType.XAPI_STATEMENTS:
            return await self._extract_xapi_statements_data(request)
        elif request.export_type == ExportType.USER_ACTIVITY:
            return await self._extract_user_activity_data(request)
        elif request.export_type == ExportType.CONTENT_PERFORMANCE:
            return await self._extract_content_performance_data(request)
        else:
            raise ValueError(f"Unsupported export type: {request.export_type}")

    async def _extract_learning_analytics_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract learning analytics data (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        return [
            {
                "user_id": "user_1",
                "program_name": "Sample Program",
                "completion_percentage": 85.5,
                "time_spent_minutes": 120,
                "last_accessed": datetime.now().isoformat(),
                "score": 87.2
            },
            {
                "user_id": "user_2", 
                "program_name": "Sample Program",
                "completion_percentage": 92.0,
                "time_spent_minutes": 95,
                "last_accessed": datetime.now().isoformat(),
                "score": 94.1
            }
        ]

    async def _extract_progress_report_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract progress report data (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        return [
            {
                "user_name": "Sample User",
                "program_title": "Training Program",
                "enrollment_date": "2024-01-15",
                "completion_date": "2024-02-20",
                "completion_status": "completed",
                "final_score": 88.5
            }
        ]

    async def _extract_engagement_summary_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract engagement summary data (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        return [
            {
                "date": "2024-01-15",
                "active_users": 45,
                "sessions_started": 67,
                "average_session_duration": 22.5,
                "engagement_score": 0.76
            }
        ]

    async def _extract_completion_report_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract completion report data (placeholder implementation)."""
        # TODO: Implement with actual analytics service when available
        return [
            {
                "program_name": "Sample Training",
                "total_enrolled": 100,
                "completed": 78,
                "completion_rate": 0.78,
                "average_completion_time_days": 14.2
            }
        ]

    async def _extract_custom_query_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract data based on custom query (placeholder implementation)."""
        # TODO: Implement with actual query engine when available
        return [
            {
                "query_result": "Custom query placeholder data",
                "timestamp": datetime.now().isoformat(),
                "result_count": 42
            }
        ]

    async def _extract_xapi_statements_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract xAPI statements data (placeholder implementation)."""
        # TODO: Implement with actual xAPI data store when available
        return [
            {
                "id": "stmt_123",
                "actor": {"name": "Sample User", "mbox": "user@example.com"},
                "verb": {"id": "http://adlnet.gov/expapi/verbs/completed"},
                "object": {"id": "http://example.com/course/1"},
                "timestamp": datetime.now().isoformat()
            }
        ]

    async def _extract_user_activity_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract user activity data (placeholder implementation)."""
        # TODO: Implement with actual user activity service when available
        return [
            {
                "user_id": "user_123",
                "activity_type": "login",
                "timestamp": datetime.now().isoformat(),
                "session_duration_minutes": 45,
                "content_accessed": "Module 1"
            }
        ]

    async def _extract_content_performance_data(
        self, request: ExportDataRequest
    ) -> List[Dict[str, Any]]:
        """Extract content performance data (placeholder implementation)."""
        # TODO: Implement with actual content performance analytics when available
        return [
            {
                "content_id": "content_456",
                "content_title": "Sample Content",
                "views": 150,
                "completions": 120,
                "average_score": 84.2,
                "engagement_rate": 0.73
            }
        ]

    async def _apply_privacy_rules(
        self,
        data: List[Dict[str, Any]],
        privacy_level: PrivacyLevel,
        include_pii: bool
    ) -> tuple[List[Dict[str, Any]], bool]:
        """Apply privacy and data protection rules to export data."""
        privacy_applied = False
        processed_data = data.copy()

        if privacy_level == PrivacyLevel.FULL_ACCESS and include_pii:
            # No privacy filtering - return full data
            return processed_data, privacy_applied

        # Define PII fields that should be removed or anonymized
        pii_fields = ["email", "full_name", "phone", "address", "ip_address"]
        sensitive_fields = ["user_id", "username"] if not include_pii else []

        if privacy_level == PrivacyLevel.ANONYMIZED:
            # Anonymize PII fields
            for record in processed_data:
                for field in pii_fields:
                    if field in record:
                        record[field] = self._anonymize_field(record[field], field)
                        privacy_applied = True
                
                # Replace user IDs with anonymous IDs
                if "user_id" in record and not include_pii:
                    record["user_id"] = self._generate_anonymous_id(record["user_id"])
                    privacy_applied = True

        elif privacy_level == PrivacyLevel.AGGREGATED_ONLY:
            # Remove individual records, keep only aggregated data
            aggregated_data = self._aggregate_data(processed_data)
            processed_data = aggregated_data
            privacy_applied = True

        elif privacy_level == PrivacyLevel.RESTRICTED:
            # Remove all PII and sensitive fields
            for record in processed_data:
                for field in pii_fields + sensitive_fields:
                    if field in record:
                        del record[field]
                        privacy_applied = True

        return processed_data, privacy_applied

    def _anonymize_field(self, value: Any, field_type: str) -> str:
        """Anonymize a specific field value."""
        if field_type == "email":
            return f"user{hash(value) % 10000}@anonymous.com"
        elif field_type == "full_name":
            return f"Anonymous User {hash(value) % 10000}"
        elif field_type in ["phone", "address"]:
            return "[REDACTED]"
        elif field_type == "ip_address":
            return "xxx.xxx.xxx.xxx"
        else:
            return f"[ANONYMIZED_{hash(value) % 10000}]"

    def _generate_anonymous_id(self, user_id: Union[UUID, str]) -> str:
        """Generate anonymous ID for user."""
        return f"anon_{hash(str(user_id)) % 100000}"

    def _aggregate_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Aggregate individual records into summary statistics."""
        if not data:
            return []

        # Simple aggregation - this would be more sophisticated in real implementation
        aggregated = {
            "total_records": len(data),
            "summary": "Aggregated data for privacy protection",
            "generated_at": datetime.now().isoformat()
        }

        # Calculate basic statistics if numeric fields are present
        numeric_fields = []
        for record in data:
            for key, value in record.items():
                if isinstance(value, (int, float)) and key not in numeric_fields:
                    numeric_fields.append(key)

        for field in numeric_fields:
            values = [record.get(field, 0) for record in data if isinstance(record.get(field), (int, float))]
            if values:
                aggregated[f"{field}_avg"] = sum(values) / len(values)
                aggregated[f"{field}_min"] = min(values)
                aggregated[f"{field}_max"] = max(values)
                aggregated[f"{field}_count"] = len(values)

        return [aggregated]

    async def _generate_export_file(
        self,
        data: List[Dict[str, Any]],
        request: ExportDataRequest
    ) -> tuple[str, int, Optional[str]]:
        """Generate export file in requested format."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{request.export_type.value}_{timestamp}.{request.export_format.value}"
        file_path = f"/tmp/exports/{filename}"  # In real app, use proper storage

        if request.export_format == ExportFormat.CSV:
            file_size, file_url = await self._generate_csv_file(data, file_path)
        elif request.export_format == ExportFormat.EXCEL:
            file_size, file_url = await self._generate_excel_file(data, file_path)
        elif request.export_format == ExportFormat.JSON:
            file_size, file_url = await self._generate_json_file(data, file_path)
        elif request.export_format == ExportFormat.PDF:
            file_size, file_url = await self._generate_pdf_file(data, file_path, request)
        elif request.export_format == ExportFormat.XML:
            file_size, file_url = await self._generate_xml_file(data, file_path)
        else:
            raise ValueError(f"Unsupported export format: {request.export_format}")

        return file_path, file_size, file_url

    async def _generate_csv_file(
        self, data: List[Dict[str, Any]], file_path: str
    ) -> tuple[int, Optional[str]]:
        """Generate CSV file from data."""
        import csv
        
        if not data:
            return 0, None

        # Get all unique keys for CSV headers
        headers: set[str] = set()
        for record in data:
            headers.update(record.keys())
        headers_list = sorted(list(headers))

        # Write CSV file
        with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers_list)
            writer.writeheader()
            for record in data:
                # Handle nested objects by converting to string
                row = {}
                for key in headers_list:
                    value = record.get(key, '')
                    if isinstance(value, (dict, list)):
                        row[key] = str(value)
                    else:
                        row[key] = value
                writer.writerow(row)

        # Get file size
        file_size = self._get_file_size(file_path)
        
        # In real implementation, upload to cloud storage and return URL
        file_url = None

        return file_size, file_url

    async def _generate_excel_file(
        self, data: List[Dict[str, Any]], file_path: str
    ) -> tuple[int, Optional[str]]:
        """Generate Excel file from data."""
        try:
            import pandas as pd
            
            if not data:
                return 0, None

            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            # Write to Excel
            df.to_excel(file_path, index=False, engine='openpyxl')
            
            file_size = self._get_file_size(file_path)
            file_url = None

            return file_size, file_url

        except ImportError:
            # Fallback to CSV if pandas not available
            logger.warning("pandas not available, falling back to CSV export")
            return await self._generate_csv_file(data, file_path.replace('.excel', '.csv'))

    async def _generate_json_file(
        self, data: List[Dict[str, Any]], file_path: str
    ) -> tuple[int, Optional[str]]:
        """Generate JSON file from data."""
        import json
        
        export_data = {
            "export_metadata": {
                "generated_at": datetime.now().isoformat(),
                "record_count": len(data)
            },
            "data": data
        }

        with open(file_path, 'w', encoding='utf-8') as jsonfile:
            json.dump(export_data, jsonfile, indent=2, ensure_ascii=False, default=str)

        file_size = self._get_file_size(file_path)
        file_url = None

        return file_size, file_url

    async def _generate_pdf_file(
        self, data: List[Dict[str, Any]], file_path: str, request: ExportDataRequest
    ) -> tuple[int, Optional[str]]:
        """Generate PDF report from data."""
        # In real implementation, use proper PDF generation library
        # For now, create a simple text-based PDF
        
        pdf_content = f"""
        Data Export Report
        Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        Export Type: {request.export_type.value}
        Records: {len(data)}
        
        {'='*50}
        
        """
        
        # Add summary statistics
        pdf_content += "SUMMARY:\n"
        pdf_content += f"Total Records: {len(data)}\n"
        
        # Add first few records as samples
        pdf_content += "\nSAMPLE DATA:\n"
        for i, record in enumerate(data[:5]):  # First 5 records
            pdf_content += f"\nRecord {i+1}:\n"
            for key, value in record.items():
                pdf_content += f"  {key}: {value}\n"

        # Write as text file (in real app, use proper PDF library)
        with open(file_path, 'w', encoding='utf-8') as pdffile:
            pdffile.write(pdf_content)

        file_size = self._get_file_size(file_path)
        file_url = None

        return file_size, file_url

    async def _generate_xml_file(
        self, data: List[Dict[str, Any]], file_path: str
    ) -> tuple[int, Optional[str]]:
        """Generate XML file from data."""
        import xml.etree.ElementTree as ET
        
        root = ET.Element("export_data")
        
        metadata = ET.SubElement(root, "metadata")
        ET.SubElement(metadata, "generated_at").text = datetime.now().isoformat()
        ET.SubElement(metadata, "record_count").text = str(len(data))
        
        records = ET.SubElement(root, "records")
        
        for i, record in enumerate(data):
            record_elem = ET.SubElement(records, "record", {"id": str(i)})
            for key, value in record.items():
                elem = ET.SubElement(record_elem, key.replace(" ", "_"))
                elem.text = str(value)

        tree = ET.ElementTree(root)
        tree.write(file_path, encoding='utf-8', xml_declaration=True)

        file_size = self._get_file_size(file_path)
        file_url = None

        return file_size, file_url

    def _get_file_size(self, file_path: str) -> int:
        """Get file size in bytes."""
        import os
        try:
            return os.path.getsize(file_path)
        except OSError:
            return 0

    async def _create_export_record(
        self,
        request: ExportDataRequest,
        user_context: Dict[str, Any],
        file_path: str,
        file_size: int,
        record_count: int
    ) -> Dict[str, Any]:
        """Create export record in database (placeholder implementation)."""
        # TODO: Implement with actual export tracking service when available
        logger.info(
            f"Export record created: {request.export_type.value} by {user_context.get('user_id')}, "
            f"records: {record_count}, size: {file_size} bytes"
        )
        
        return {
            "id": f"export_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "export_type": request.export_type.value,
            "export_format": request.export_format.value,
            "created_by": user_context["user_id"],
            "file_path": file_path,
            "file_size": file_size,
            "record_count": record_count,
            "created_at": datetime.now().isoformat(),
            "status": "completed"
        }

    async def _create_scheduled_export(
        self,
        request: ExportDataRequest,
        user_context: Dict[str, Any]
    ) -> UUID:
        """Create scheduled export configuration (placeholder implementation)."""
        # TODO: Implement with actual scheduling service when available
        logger.info(
            f"Scheduled export created: {request.export_type.value} by {user_context.get('user_id')}"
        )
        
        # Return placeholder UUID
        return UUID("12345678-1234-5678-9012-123456789012")

    async def _publish_export_completion_event(
        self,
        request: ExportDataRequest,
        response: ExportDataResponse,
        user_context: Dict[str, Any]
    ) -> None:
        """Publish export completion event."""
        exporter_info = self._extract_user_info(user_context)

        await self._publish_event(
            "publish_analytics_data_exported",
            export_id=str(response.export.id) if response.export else None,
            exporter_id=exporter_info["user_id"],
            exporter_name=exporter_info["user_name"],
            exporter_email=exporter_info["user_email"],
            export_type=request.export_type.value,
            export_format=request.export_format.value,
            records_exported=response.records_exported,
            file_size_bytes=response.file_size_bytes,
            privacy_level=request.privacy_level.value,
            privacy_applied=response.privacy_applied,
            export_duration_ms=response.export_duration_ms,
            scheduled_export=request.schedule_recurring,
            export_timestamp=datetime.now().isoformat()
        )

    async def _send_export_notifications(
        self,
        notification_emails: List[str],
        response: ExportDataResponse
    ) -> None:
        """Send export completion notifications."""
        # In real implementation, this would integrate with email service
        logger.info(
            f"Sending export notifications to {len(notification_emails)} recipients: "
            f"Export completed with {response.records_exported} records"
        )
        
        # Placeholder for email notification integration
        # await email_service.send_export_notification(
        #     recipients=notification_emails,
        #     export_data=response
        # )

    async def _handle_service_error(self, error: Exception, context: str) -> None:
        """Handle service errors with rollback."""
        error_msg = f"Service error in {context}: {str(error)}"
        logger.error(error_msg, exc_info=True)

        try:
            await self.session.rollback()
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")

        raise RuntimeError(error_msg) from error