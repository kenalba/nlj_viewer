# Flow Editor Version Management Integration

The Flow Editor now includes comprehensive version management capabilities, allowing users to track changes, compare versions, and restore previous states directly within the editing interface.

## Integration Overview

The version management system is integrated at three levels:

1. **FlowEditor Component** - Enhanced with version management controls and hooks
2. **FlowViewer Component** - Updated to pass version management props to UnifiedSidebar
3. **UnifiedSidebar Component** - Extended with a dedicated version management tab

## Usage Example

### Basic Integration with ContentItem

```tsx
import { FlowEditor } from '../editor/FlowEditor';
import { useVersionManagement } from '../hooks/useVersionManagement';
import type { ContentItem } from '../api/content';

function ContentEditorPage({ contentItem }: { contentItem: ContentItem }) {
  const handleVersionSave = async (changeSummary: string) => {
    // Custom version save logic if needed
    console.log('Saving version with summary:', changeSummary);
  };

  return (
    <FlowEditor
      scenario={contentItem.nlj_data}
      contentItem={contentItem}
      canManageVersions={true}
      onVersionSave={handleVersionSave}
      onBack={() => navigate('/content')}
      onPlay={(scenario) => navigate(`/play/${contentItem.id}`)}
    />
  );
}
```

### Advanced Integration with Custom Logic

```tsx
import { FlowEditor } from '../editor/FlowEditor';
import { useVersionManagement } from '../hooks/useVersionManagement';
import { workflowApi } from '../api/workflow';

function AdvancedContentEditor({ contentItem }: { contentItem: ContentItem }) {
  const [currentScenario, setCurrentScenario] = useState(contentItem.nlj_data);
  
  const versionManagement = useVersionManagement({
    contentItem,
    onVersionChange: (version) => {
      // Custom handling when version changes
      if (version.nlj_data) {
        setCurrentScenario(version.nlj_data);
        // Optional: Show notification
        showNotification(`Restored to version ${version.version_number}`);
      }
    }
  });

  const handleVersionSave = async (changeSummary: string) => {
    try {
      await versionManagement.createVersion(
        currentScenario,
        contentItem.title,
        contentItem.description,
        changeSummary
      );
      showNotification('Version saved successfully');
    } catch (error) {
      showError('Failed to save version');
    }
  };

  return (
    <FlowEditor
      scenario={currentScenario}
      contentItem={contentItem}
      canManageVersions={userHasEditPermissions}
      onVersionSave={handleVersionSave}
      onScenarioChange={(updatedScenario) => {
        setCurrentScenario(updatedScenario);
      }}
      onBack={() => navigate('/content')}
    />
  );
}
```

## New FlowEditor Props

### Version Management Props

```tsx
interface FlowEditorProps {
  // ... existing props
  
  // Version management
  contentItem?: ContentItem;           // Required for version management
  canManageVersions?: boolean;         // User permission check
  onVersionSave?: (changeSummary: string) => Promise<void>; // Custom save handler
}
```

### ContentItem Requirements

The `ContentItem` interface must include:

```tsx
interface ContentItem {
  id: string;
  title: string;
  description: string;
  nlj_data: any;          // The NLJ scenario data
  // ... other fields
}
```

## Features Available

### 1. Header Integration

- **Version Badge**: Shows current version number (e.g., "v3")
- **Unsaved Changes Indicator**: Shows when there are modifications
- **Version History Button**: Badged with total version count
- **Quick Access**: One-click access to version management

### 2. Version Management Sidebar Tab

Accessed via the purple History icon in the Flow Editor header:

- **Version History**: Chronological list of all versions
- **Version Comparison**: Side-by-side comparison of any two versions
- **Content Rollback**: One-click restore to previous versions
- **Save New Version**: Create versions with change summaries
- **Version Statistics**: Total, draft, published, and archived counts

### 3. Enhanced Save Workflow

#### Standard Save (without version management)
```tsx
<FlowEditor
  scenario={scenario}
  onSave={(scenario) => saveToLocalStorage(scenario)}
/>
```

#### Version-Aware Save
```tsx
<FlowEditor
  scenario={scenario}
  contentItem={contentItem}
  canManageVersions={true}
  onVersionSave={async (changeSummary) => {
    await createNewVersion(scenario, changeSummary);
  }}
/>
```

### 4. Bottom Toolbar Integration

The floating bottom toolbar automatically adapts:

- **Without Version Management**: Shows standard "Save Changes" button
- **With Version Management**: Shows "Save New Version" with prompt for change summary

## Version Management Tab Features

### Version History Viewer
- Chronological display of all versions
- Version metadata (title, description, change summary, creator, timestamps)
- Status indicators (Draft, Published, Archived)
- Selection for comparison
- Action buttons (View, Restore)

### Version Comparison Modal
- Side-by-side version comparison
- Three view modes:
  1. **Overview**: Metadata and basic information
  2. **Differences**: Highlighted changes between versions
  3. **Content Details**: Raw JSON comparison
- Restore actions from comparison view

### Version Operations
- **Create Version**: Save current editor state as new version
- **Restore Version**: Load previous version into editor (creates new version)
- **View Version**: Preview version content
- **Compare Versions**: Detailed diff analysis

## Technical Implementation

### Component Hierarchy

```
FlowEditor
├── Enhanced header with version controls
├── FlowViewer (enhanced with version props)
│   └── UnifiedSidebar (extended with version tab)
│       ├── Node Editor Tab
│       ├── Edge Editor Tab
│       └── Version Manager Tab (NEW)
└── Enhanced bottom toolbar
```

### Data Flow

1. **Version Changes**: `useVersionManagement` hook → `onVersionChange` callback → FlowEditor state update
2. **Version Creation**: Editor data → `handleVersionSave` → API call → Hook refresh
3. **Version Restoration**: Selected version → API call → Hook callback → Editor update

### State Management

```tsx
// In FlowEditor
const versionManagement = useVersionManagement({
  contentItem,
  onVersionChange: (version) => {
    if (version.nlj_data) {
      setEditedScenario(version.nlj_data);
      setIsDirty(false);
    }
  }
});

// Change detection
const hasUnsavedChanges = useCallback(() => {
  if (!versionManagement?.currentVersion?.nlj_data) return isDirty;
  return JSON.stringify(editedScenario) !== 
         JSON.stringify(versionManagement.currentVersion.nlj_data);
}, [editedScenario, versionManagement?.currentVersion]);
```

## Migration Guide

### From Standard FlowEditor

1. **Add ContentItem**: Pass the content item from your data source
2. **Enable Permissions**: Set `canManageVersions` based on user role
3. **Handle Version Save**: Implement `onVersionSave` callback
4. **Update Dependencies**: Ensure version management components are available

```tsx
// Before
<FlowEditor
  scenario={scenario}
  onSave={handleSave}
  onBack={handleBack}
/>

// After
<FlowEditor
  scenario={scenario}
  contentItem={contentItem}
  canManageVersions={user.canEdit}
  onVersionSave={handleVersionSave}
  onSave={handleSave}
  onBack={handleBack}
/>
```

### Backend Requirements

Ensure these API endpoints are available:
- `GET /api/workflow/content/{content_id}/versions`
- `POST /api/workflow/versions`
- `POST /api/workflow/content/{content_id}/restore`
- `PATCH /api/workflow/versions/{version_id}/metadata`

### Error Handling

The version management system includes comprehensive error handling:

```tsx
const handleVersionSave = async (changeSummary: string) => {
  try {
    await versionManagement.createVersion(/* ... */);
    // Success handling automatic via hook
  } catch (error) {
    // Error notifications automatic via hook
    console.error('Version save failed:', error);
  }
};
```

## Best Practices

1. **Always Check Permissions**: Only enable version management for authorized users
2. **Provide Clear Feedback**: The system provides automatic notifications, but consider custom messages for important operations
3. **Handle Loading States**: Version operations are async and include loading indicators
4. **Version Naming**: Encourage meaningful change summaries for better version tracking
5. **Test Restoration**: Verify that version restoration works correctly with your specific NLJ scenario structure

## Troubleshooting

### Common Issues

1. **Version Tab Not Showing**: Ensure `contentItem` prop is provided and `canManageVersions` is true
2. **API Errors**: Verify backend endpoints are properly configured
3. **State Sync Issues**: Check that `onVersionChange` callback properly updates editor state
4. **Permission Errors**: Ensure user has appropriate role-based permissions

### Debug Mode

Enable debug logging:

```tsx
const versionManagement = useVersionManagement({
  contentItem,
  onVersionChange: (version) => {
    console.log('Version changed:', version);
    // Handle version change
  }
});
```

## Future Enhancements

Planned improvements:
- Version branching and merging
- Collaborative editing with conflict resolution
- Automated version creation on significant changes
- Integration with approval workflows
- Version templates and standards

---

The Flow Editor version management integration provides a comprehensive solution for content versioning within the visual editing interface, following modern design patterns and providing excellent user experience.