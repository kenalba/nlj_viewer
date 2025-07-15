# Bug Tracker - NLJ Viewer

## Status Legend

- 🐛 **Open**: Bug needs to be fixed
- 🔧 **In Progress**: Currently being worked on
- ✅ **Fixed**: Bug has been resolved
- 🚫 **Wontfix**: Not going to be fixed

NEW BUGS (unformatted)

- The progress bar doesn't work so well, since I restart afterwards. We should remove it unless we have a predictable way of knowing how far into an NLJ we are -- which we rarely do. We'll need to think about ways to understand it.

## Bug #4: Survey Question State Persistence Issue

**Status:** ✅ **Fixed**  
**Priority:** High  
**Assigned:** Claude  
**Labels:** `critical`, `state-management`, `survey`, `ui`

**Description:**
When answering consecutive survey questions of the same type (e.g., likert_scale), the user's answer from the previous question remains selected when navigating to the next question, creating a confusing user experience.

**Steps to Reproduce:**
1. Answer a survey question (e.g., likert_scale)
2. Navigate to another survey question of the same type immediately afterwards
3. Observe that the previous answer is still selected on the new question

**Expected Behavior:**
Each new question should start with a clean slate - no pre-selected answers.

**Actual Behavior:**
The previous question's answer carries over and appears selected on the new question.

**Debug Information:**
- Node type: `likert_scale`
- Issue occurs between consecutive questions of the same type
- State management issue with component reuse

**Fix Applied:**
Added `key={node.id}` prop to all question components in `NodeRenderer.tsx` to force React to create fresh component instances for each question, automatically resetting all state when navigating between questions. This elegant solution fixes the issue for all question types without requiring individual useEffect hooks in each component.

**Regression Tests:**
Added comprehensive tests in `bug-regressions.test.tsx` to ensure state is properly reset between questions of the same type.

---

## Bug #5: Survey Question Navigation Failure

**Status:** ✅ **Fixed**  
**Priority:** High  
**Assigned:** Claude  
**Labels:** `critical`, `navigation`, `survey`, `completion`

**Description:**
After answering a survey question, the application fails to navigate to the next node. Instead, it incorrectly marks the scenario as complete and triggers duplicate completion events.

**Steps to Reproduce:**
1. Answer a survey question
2. Submit the answer
3. Observe that navigation fails and scenario is marked as complete

**Expected Behavior:**
After answering a question, the application should navigate to the next node in the scenario flow.

**Actual Behavior:**
The scenario is immediately marked as complete, preventing further navigation. Multiple completion events are triggered.

**Debug Information:**
```
Question Answer
User answered question: correct
Data: {currentNode: 'q1538', nodeType: 'likert_scale', isCorrect: true, response: 4}
Completion
Scenario completed
Data: {score: undefined, visitedNodes: Array(13), finalVariables: {…}}
State Change: COMPLETE_SCENARIO
```

**Root Cause:**
The completion logic is being triggered prematurely instead of following the normal node navigation flow.

**Fix Applied:**
1. **Modified navigation logic in `NodeRenderer.tsx`**: Changed `handleQuestionAnswer` to always navigate to the next node first, then play completion sound if the next node is an end node, instead of completing the scenario immediately.
2. **Added automatic completion to end nodes**: Added `useEffect` hook to the end node case to automatically call `completeScenario()` when the end node is rendered, ensuring proper completion flow.
3. **Improved error handling**: Added better error logging and handling for cases where navigation fails due to missing links.

**Regression Tests:**
Added comprehensive tests in `bug-regressions.test.tsx` to verify proper navigation flow and completion behavior.

---

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
