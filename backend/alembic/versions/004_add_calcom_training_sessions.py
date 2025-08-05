"""Add Cal.com training session integration tables

Revision ID: 004_calcom_training_sessions
Revises: 003_add_media_items
Create Date: 2025-08-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_calcom_training_sessions'
down_revision = '003_add_media_items'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create training_sessions table
    op.create_table('training_sessions',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('cal_event_type_id', sa.Integer(), nullable=True, comment='Cal.com event type ID'),
    sa.Column('cal_event_type_slug', sa.String(length=100), nullable=True, comment='Cal.com event type slug'),
    sa.Column('capacity', sa.Integer(), nullable=False, server_default='20', comment='Maximum number of attendees'),
    sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='120', comment='Session duration in minutes'),
    sa.Column('location', sa.String(length=255), nullable=True, comment='Training location/venue'),
    sa.Column('location_details', sa.JSON(), nullable=True, comment='Additional location metadata (address, room, etc.)'),
    sa.Column('prerequisites', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True, comment='Required content completion UUIDs'),
    sa.Column('content_items', postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True, comment='Related NLJ content item UUIDs'),
    sa.Column('learning_objectives', postgresql.ARRAY(sa.String()), nullable=True, comment='Learning objectives for this session'),
    sa.Column('instructor_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('instructor_requirements', sa.JSON(), nullable=True, comment='Required instructor qualifications'),
    sa.Column('preferred_times', sa.JSON(), nullable=True, comment='Preferred scheduling times and patterns'),
    sa.Column('buffer_time_minutes', sa.Integer(), nullable=True, server_default='15', comment='Buffer time between sessions'),
    sa.Column('allow_waitlist', sa.Boolean(), nullable=True, server_default='true', comment='Allow waitlist when full'),
    sa.Column('requires_approval', sa.Boolean(), nullable=True, server_default='false', comment='Requires manager approval for enrollment'),
    sa.Column('auto_approve', sa.Boolean(), nullable=True, server_default='true', comment='Automatically approve eligible learners'),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    sa.Column('is_published', sa.Boolean(), nullable=False, server_default='false', comment='Published to learners'),
    sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['instructor_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_training_sessions_cal_event_type_id'), 'training_sessions', ['cal_event_type_id'], unique=False)
    op.create_index(op.f('ix_training_sessions_cal_event_type_slug'), 'training_sessions', ['cal_event_type_slug'], unique=False)
    op.create_index(op.f('ix_training_sessions_title'), 'training_sessions', ['title'], unique=False)

    # Create training_instances table
    op.create_table('training_instances',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('cal_booking_id', sa.BigInteger(), nullable=True, comment='Cal.com booking ID'),
    sa.Column('cal_booking_uid', sa.String(length=255), nullable=True, comment='Cal.com booking UID'),
    sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
    sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
    sa.Column('timezone', sa.String(length=50), nullable=False, server_default='UTC'),
    sa.Column('actual_location', sa.String(length=255), nullable=True, comment='Actual location if different from default'),
    sa.Column('instance_notes', sa.Text(), nullable=True, comment='Notes specific to this instance'),
    sa.Column('max_attendees', sa.Integer(), nullable=True, comment='Override default capacity for this instance'),
    sa.Column('status', sa.String(length=30), nullable=False, server_default='scheduled'),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancellation_reason', sa.Text(), nullable=True),
    sa.Column('attendance_taken', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('attendance_taken_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('attendance_taken_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['attendance_taken_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('cal_booking_id'),
    sa.UniqueConstraint('cal_booking_uid')
    )
    op.create_index(op.f('ix_training_instances_status'), 'training_instances', ['status'], unique=False)

    # Create training_bookings table
    op.create_table('training_bookings',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('instance_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('learner_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('cal_booking_id', sa.BigInteger(), nullable=True, comment='Cal.com booking ID'),
    sa.Column('cal_attendee_id', sa.BigInteger(), nullable=True, comment='Cal.com attendee ID'),
    sa.Column('registration_method', sa.String(length=30), nullable=False, server_default='online'),
    sa.Column('booking_status', sa.String(length=30), nullable=False, server_default='confirmed'),
    sa.Column('is_waitlisted', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('waitlist_position', sa.Integer(), nullable=True, comment='Position on waitlist'),
    sa.Column('waitlist_notified', sa.Boolean(), nullable=True, server_default='false', comment='Notified when slot becomes available'),
    sa.Column('registration_notes', sa.Text(), nullable=True, comment='Notes from learner during registration'),
    sa.Column('special_requirements', sa.JSON(), nullable=True, comment='Special accommodations or requirements'),
    sa.Column('confirmation_sent', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('confirmation_sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('reminder_count', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('last_reminder_sent', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancelled_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('cancellation_reason', sa.String(length=100), nullable=True),
    sa.Column('registered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['cancelled_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['instance_id'], ['training_instances.id'], ),
    sa.ForeignKeyConstraint(['learner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_training_bookings_booking_status'), 'training_bookings', ['booking_status'], unique=False)

    # Create attendance_records table
    op.create_table('attendance_records',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('instance_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('booking_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('learner_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('attended', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('check_in_time', sa.DateTime(timezone=True), nullable=True),
    sa.Column('check_out_time', sa.DateTime(timezone=True), nullable=True),
    sa.Column('attendance_method', sa.String(length=20), nullable=False, server_default='in_person'),
    sa.Column('participation_score', sa.Float(), nullable=True, comment='Participation score 0.0-1.0'),
    sa.Column('engagement_notes', sa.Text(), nullable=True, comment='Notes about learner engagement'),
    sa.Column('completed', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('completion_time', sa.DateTime(timezone=True), nullable=True),
    sa.Column('assessment_score', sa.Float(), nullable=True, comment='Assessment score if applicable'),
    sa.Column('certificate_issued', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('certificate_issued_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('instructor_notes', sa.Text(), nullable=True, comment='Instructor notes about this learner'),
    sa.Column('follow_up_required', sa.Boolean(), nullable=True, server_default='false', comment='Requires follow-up training or coaching'),
    sa.Column('follow_up_notes', sa.Text(), nullable=True),
    sa.Column('recorded_by_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('recorded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['booking_id'], ['training_bookings.id'], ),
    sa.ForeignKeyConstraint(['instance_id'], ['training_instances.id'], ),
    sa.ForeignKeyConstraint(['learner_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['recorded_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Create xapi_event_log table
    op.create_table('xapi_event_log',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('event_id', sa.String(length=255), nullable=False, comment='Unique event identifier'),
    sa.Column('event_type', sa.String(length=50), nullable=False),
    sa.Column('kafka_topic', sa.String(length=100), nullable=False),
    sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('instance_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('booking_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('learner_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.Column('actor_email', sa.String(length=255), nullable=True),
    sa.Column('verb_id', sa.String(length=255), nullable=False),
    sa.Column('object_id', sa.String(length=255), nullable=False),
    sa.Column('event_payload', sa.JSON(), nullable=False, comment='Full xAPI event payload'),
    sa.Column('publish_status', sa.String(length=20), nullable=False, server_default='published'),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('correlation_id', sa.String(length=255), nullable=True, comment='For tracking related events'),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_retry_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id')
    )
    op.create_index(op.f('ix_xapi_event_log_actor_email'), 'xapi_event_log', ['actor_email'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_booking_id'), 'xapi_event_log', ['booking_id'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_correlation_id'), 'xapi_event_log', ['correlation_id'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_event_type'), 'xapi_event_log', ['event_type'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_instance_id'), 'xapi_event_log', ['instance_id'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_kafka_topic'), 'xapi_event_log', ['kafka_topic'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_learner_id'), 'xapi_event_log', ['learner_id'], unique=False)
    op.create_index(op.f('ix_xapi_event_log_session_id'), 'xapi_event_log', ['session_id'], unique=False)


def downgrade() -> None:
    # Drop all tables in reverse order
    op.drop_table('xapi_event_log')
    op.drop_table('attendance_records')
    op.drop_table('training_bookings')
    op.drop_table('training_instances')
    op.drop_table('training_sessions')