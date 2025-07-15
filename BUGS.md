# Bug Tracker - NLJ Viewer

## Status Legend
- 🐛 **Open**: Bug needs to be fixed
- 🔧 **In Progress**: Currently being worked on
- ✅ **Fixed**: Bug has been resolved
- 🚫 **Wontfix**: Not going to be fixed

---

## Bug #1: Pre-completed Second Question Issue
**Status:** ✅ **Fixed**  
**Priority:** High  
**Assigned:** Claude  
**Labels:** `ui`, `state-management`

**Description:**
When viewing a question and answering it, if another question immediately follows, the second question appears pre-completed, preventing answer selection and progression.

**Steps to Reproduce:**
1. Load a scenario with consecutive questions
2. Answer the first question
3. Observe the second question appears pre-selected
4. Cannot select different answer or proceed

**Expected Behavior:**
Each question should start fresh without pre-selected answers.

**Actual Behavior:**
Second question appears with an answer already selected, blocking user interaction.

**Fix Applied:**
Added `useEffect` hook in `ChoiceSelector.tsx` to reset component state (`selectedChoice`, `showFeedback`, `selectedChoiceNode`) when the `choices` prop changes, ensuring each new question starts fresh.

---

## Bug #2: Feedback Scroll Issue
**Status:** ✅ **Fixed**  
**Priority:** High  
**Assigned:** Claude  
**Labels:** `ui`, `ux`, `scrolling`

**Description:**
When feedback appears after answering a question, it displays at the bottom of the screen without auto-scrolling, making it easy to miss.

**Steps to Reproduce:**
1. Answer a question with feedback
2. Feedback appears below the fold
3. Screen doesn't scroll to show feedback

**Expected Behavior:**
Page should auto-scroll to show feedback or feedback should appear in a more visible location.

**Actual Behavior:**
Feedback appears at bottom without scrolling, potentially going unnoticed.

**Fix Applied:**
Added `useRef` and `useEffect` in `ChoiceSelector.tsx` to automatically scroll to the feedback section when it appears, using `scrollIntoView` with smooth behavior and proper positioning.

---

## Bug #3: GitHub Pages Deployment Permission Error
**Status:** ✅ **Fixed**  
**Priority:** High  
**Assigned:** Claude  
**Labels:** `deployment`, `github-actions`

**Description:**
GitHub Actions workflow fails with permission denied error when trying to push to gh-pages branch.

**Error Details:**
```
remote: Permission to kenalba/nlj_viewer.git denied to github-actions[bot].
fatal: unable to access 'https://github.com/kenalba/nlj_viewer.git/': The requested URL returned error: 403
Error: Action failed with "The process '/usr/bin/git' failed with exit code 128"
```

**Root Cause:**
The deployment action was using `peaceiris/actions-gh-pages@v3` which requires specific permissions that may not be configured correctly.

**Fix Applied:**
Updated `.github/workflows/deploy.yml` to use the modern GitHub Pages deployment approach:
- Added proper `permissions` section with `contents: read`, `pages: write`, `id-token: write`
- Used `actions/configure-pages@v4`, `actions/upload-pages-artifact@v3`, and `actions/deploy-pages@v4`
- Added `environment` configuration for better security and tracking
- Removed the problematic `peaceiris/actions-gh-pages@v3` action

---

## How to Report New Bugs

1. **Use the template below:**
   ```
   ## Bug #X: [Brief Title]
   **Status:** 🐛 **Open**
   **Priority:** [High/Medium/Low]
   **Assigned:** -
   **Labels:** `tag1`, `tag2`

   **Description:**
   [Detailed description]

   **Steps to Reproduce:**
   1. Step 1
   2. Step 2
   3. Step 3

   **Expected Behavior:**
   [What should happen]

   **Actual Behavior:**
   [What actually happens]
   ```

2. **Add screenshots or error logs if helpful**
3. **Test in both development and production environments**
4. **Include browser/device information if relevant**

---

## Bug Fixing Workflow

1. **Assign** yourself to the bug
2. **Update status** to 🔧 **In Progress**
3. **Create a branch** for the fix if needed
4. **Test the fix** thoroughly
5. **Update status** to ✅ **Fixed**
6. **Close** the bug or move to verification