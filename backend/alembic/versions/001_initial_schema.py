"""001_initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-27 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable PostgreSQL Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 2. Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    # 3. Profiles Table with Vector Embedding support
    op.create_table(
        'profiles',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('avatar_emoji', sa.String(length=10), nullable=False, server_default='🚀'),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('interests', sa.JSON(), nullable=False),
        sa.Column('skills', sa.JSON(), nullable=False),
        sa.Column('embedding_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_profiles_user_id', 'profiles', ['user_id'], unique=True)

    # 4. Spaces Table
    op.create_table(
        'spaces',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('max_capacity', sa.Integer(), nullable=False, server_default='150'),
        sa.Column('proximity_radius', sa.Float(), nullable=False, server_default='160.0'),
        sa.Column('boundary_width', sa.Integer(), nullable=False, server_default='3200'),
        sa.Column('boundary_height', sa.Integer(), nullable=False, server_default='2400'),
        sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_spaces_slug', 'spaces', ['slug'], unique=True)

    # 5. User Positions (Spatial tracking)
    op.create_table(
        'user_positions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('space_id', sa.String(length=36), sa.ForeignKey('spaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('x', sa.Float(), nullable=False, server_default='400.0'),
        sa.Column('y', sa.Float(), nullable=False, server_default='300.0'),
        sa.Column('last_seen', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_user_space_pos', 'user_positions', ['space_id', 'user_id'], unique=True)
    op.create_index('idx_spatial_coords', 'user_positions', ['space_id', 'x', 'y'])

    # 6. Chat Messages Table
    op.create_table(
        'chat_messages',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('space_id', sa.String(length=36), sa.ForeignKey('spaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recipient_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('room_key', sa.String(length=100), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('message_type', sa.String(length=20), nullable=False, server_default='text'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_room_created', 'chat_messages', ['room_key', 'created_at'])
    op.create_index('idx_space_room', 'chat_messages', ['space_id', 'room_key'])


def downgrade() -> None:
    op.drop_table('chat_messages')
    op.drop_table('user_positions')
    op.drop_table('spaces')
    op.drop_table('profiles')
    op.drop_table('users')
