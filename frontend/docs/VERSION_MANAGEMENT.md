# Content Version Management System

The NLJ Platform includes a comprehensive version management system that allows creators to track changes, compare different versions, and restore previous content states.

## Features

- **Version History**: Track all changes to content with detailed version information
- **Version Comparison**: Side-by-side comparison of any two versions
- **Content Rollback**: Restore any previous version (creates new version)
- **Change Tracking**: Detailed change summaries and metadata
- **Status Management**: Draft, Published, and Archived version states

## Components

### Core Components

#### `VersionHistoryViewer`
Displays a chronological list of all versions for a content item.

```tsx
<VersionHistoryViewer
  contentId={contentItem.id}
  versions={versions}
  currentVersionId={currentVersion?.id}
  onCompareVersions={(v1, v2) => handleCompare(v1, v2)}
  onRestoreVersion={(version) => handleRestore(version)}
  onViewVersion={(version) => handleView(version)}
  canManageVersions={userCanManage}
/>
```

#### `VersionComparisonModal`
Provides detailed side-by-side comparison of two versions.

```tsx
<VersionComparisonModal
  open={comparisonOpen}
  onClose={() => setComparisonOpen(false)}
  version1={selectedVersion1}
  version2={selectedVersion2}
  onRestoreVersion={(version) => handleRestore(version)}
  canManageVersions={userCanManage}
/>
```

#### `VersionManagerTab`
Complete version management interface designed for sidebar integration.

```tsx
<VersionManagerTab
  contentItem={contentItem}
  currentNljData={editorData}
  onVersionRestore={(version) => loadVersionIntoEditor(version)}
  onVersionSave={(summary) => saveNewVersion(summary)}
  canManageVersions={userHasPermissions}
/>
```

### React Hook

#### `useVersionManagement`
React hook that provides version management functionality.

```tsx
const {
  versions,
  loading,
  currentVersion,
  publishedVersion,
  createVersion,
  restoreVersion,
  loadVersions,
  getVersionStats
} = useVersionManagement({
  contentItem,
  onVersionChange: (version) => {
    // Handle version changes
    if (version.nlj_data) {
      setEditorData(version.nlj_data);
    }
  }
});
```

## API Methods

The `workflowApi` provides these version management methods:

### Version Retrieval
```tsx
// Get all versions for content
const versions = await workflowApi.getContentVersions(contentId);

// Get specific version
const version = await workflowApi.getVersion(versionId);
```

### Version Creation
```tsx
// Create new version
const newVersion = await workflowApi.createVersion({
  content_id: contentId,
  nlj_data: scenarioData,
  title: "Updated Scenario",
  description: "Description of changes",
  change_summary: "Added new quiz questions"
});
```

### Version Management
```tsx
// Restore previous version (creates new version)
const restoredVersion = await workflowApi.restoreVersion(
  contentId,
  sourceVersionId,
  "Restored from version 3"
);

// Update version metadata
const updatedVersion = await workflowApi.updateVersionMetadata(versionId, {
  title: "New Title",
  change_summary: "Updated title"
});

// Archive version
const archivedVersion = await workflowApi.archiveVersion(versionId);
```

### Version Comparison
```tsx
const comparison = await workflowApi.compareVersions(version1Id, version2Id);
// Returns: { version1, version2, differences }
```

## Integration Examples

### Basic Flow Editor Integration

```tsx
import { useVersionManagement } from '../hooks/useVersionManagement';
import { VersionManagerTab } from '../components/VersionManagerTab';

function FlowEditor({ contentItem }) {
  const [editorData, setEditorData] = useState(contentItem.nlj_data);
  
  const {
    createVersion,
    restoreVersion,
    versions
  } = useVersionManagement({
    contentItem,
    onVersionChange: (version) => {
      if (version.nlj_data) {
        setEditorData(version.nlj_data);
      }
    }
  });

  const handleSaveVersion = async (changeSummary) => {
    await createVersion(
      editorData,
      contentItem.title,
      contentItem.description,
      changeSummary
    );
  };

  return (
    <div>
      {/* Your Flow Editor UI */}
      <VersionManagerTab
        contentItem={contentItem}
        currentNljData={editorData}
        onVersionRestore={(version) => {
          if (version.nlj_data) {
            setEditorData(version.nlj_data);
          }
        }}
        onVersionSave={handleSaveVersion}
        canManageVersions={true}
      />
    </div>
  );
}
```

### Toolbar Integration

```tsx
import { FlowEditorVersionIntegration } from '../components/FlowEditorVersionIntegration';

function FlowEditorToolbar({ contentItem, editorData, onDataChange }) {
  return (
    <Toolbar>
      {/* Other toolbar items */}
      <FlowEditorVersionIntegration
        contentItem={contentItem}
        currentNljData={editorData}
        onNljDataChange={onDataChange}
        canManageVersions={true}
      />
    </Toolbar>
  );
}
```

## Version States

### VersionStatus Enum
- **DRAFT**: Version being edited by creator
- **PUBLISHED**: Live version available to users  
- **ARCHIVED**: Older version kept for history

### Usage Patterns

#### Creating New Versions
```tsx
// When user makes significant changes
const newVersion = await createVersion(
  currentData,
  contentItem.title,
  contentItem.description,
  "Added interactive quiz section"
);
```

#### Restoring Previous Versions
```tsx
// Restore creates a new version based on old data
const restoredVersion = await restoreVersion(
  oldVersion,
  "Restored working version before bug"
);
```

#### Comparing Versions
```tsx
// Compare any two versions
const handleCompare = (version1, version2) => {
  setCompareVersions([version1, version2]);
  setComparisonModalOpen(true);
};
```

## Best Practices

1. **Save Meaningful Versions**: Create versions at logical checkpoints with descriptive change summaries
2. **Use Comparison**: Compare versions before restoring to understand changes
3. **Version Naming**: Use clear, descriptive change summaries
4. **Archive Management**: Archive old versions that are no longer needed
5. **Testing Workflow**: Test restored versions before publishing

## Backend Requirements

The version management system requires these backend endpoints:

- `GET /api/workflow/content/{content_id}/versions` - List versions
- `GET /api/workflow/versions/{version_id}` - Get version details
- `POST /api/workflow/versions` - Create new version
- `POST /api/workflow/content/{content_id}/restore` - Restore version
- `PATCH /api/workflow/versions/{version_id}/metadata` - Update metadata
- `POST /api/workflow/versions/{version_id}/archive` - Archive version
- `POST /api/workflow/versions/compare` - Compare versions

See the backend workflow API documentation for detailed endpoint specifications.

## Permissions

Version management respects role-based permissions:

- **Players**: Can view version history only
- **Creators**: Can create, restore, and manage their own content versions
- **Reviewers/Approvers**: Can view and compare versions during review
- **Admins**: Full version management capabilities

## Error Handling

All version operations include comprehensive error handling with user-friendly messages via the notification system (notistack). Failed operations will show appropriate error messages and not affect the current editor state.