# Manual Testing Checklist - NLJ Viewer

## Overview
This comprehensive manual testing checklist covers all aspects of the NLJ Viewer application including NLJ scenarios, Trivie quizzes, and survey workflows. Follow this checklist to ensure thorough testing of all functionality.

## Test Environment Setup

### Pre-Testing Setup
- [ ] Application loads at `http://localhost:5173`
- [ ] Browser developer tools are open for debugging
- [ ] Test files are available in `/static/` directories
- [ ] Audio is enabled for feedback testing
- [ ] Network connection is stable for file uploads

### Test Data Locations
- **NLJ Scenarios**: `/static/sample_nljs/`
- **Trivie Quizzes**: `/static/sample_trivie_quiz/`
- **Survey Templates**: `/static/sample_surveys/`

---

## 1. Application Initialization & Core Features

### 1.1 Application Launch
- [ ] **Load Application**: Navigate to `http://localhost:5173`
- [ ] **Initial State**: Verify clean initial state with no scenarios loaded
- [ ] **UI Elements**: Confirm all header elements (theme toggle, sound toggle) are present
- [ ] **Responsive Design**: Test on different screen sizes (mobile, tablet, desktop)

### 1.2 Theme System
- [ ] **Theme Toggle**: Switch between Hyundai and Unfiltered themes
- [ ] **Visual Consistency**: Verify colors, fonts, and styling update correctly
- [ ] **Theme Persistence**: Refresh page and confirm theme persists
- [ ] **Mobile Theme**: Test theme switching on mobile devices

### 1.3 Audio System
- [ ] **Sound Toggle**: Enable/disable audio feedback
- [ ] **Audio Feedback**: Test click, correct, incorrect, and navigation sounds
- [ ] **Audio Persistence**: Verify audio setting persists across page refreshes
- [ ] **Mobile Audio**: Test audio functionality on mobile devices

---

## 2. Scenario Loading & File Management

### 2.1 NLJ Scenario Loading
- [ ] **File Upload**: Upload sample NLJ files from `/static/sample_nljs/`
- [ ] **File Validation**: Test invalid JSON files and error handling
- [ ] **Large Files**: Test with complex scenarios (multiple nodes, media)
- [ ] **Scenario Selection**: Use dropdown to select from sample scenarios
- [ ] **Load Confirmation**: Verify scenario loads with proper node count display

### 2.2 Trivie Quiz Loading
- [ ] **Excel Upload**: Upload Trivie Excel files from `/static/sample_trivie_quiz/`
- [ ] **Conversion Process**: Verify Excel-to-NLJ conversion works correctly
- [ ] **Question Types**: Confirm all question types convert properly
- [ ] **Media Handling**: Test scenarios with embedded media
- [ ] **Error Handling**: Test with malformed Excel files

### 2.3 Survey Template Loading
- [ ] **Template Selection**: Load automotive and cross-industry survey templates
- [ ] **Question Flow**: Verify survey question progression
- [ ] **Response Validation**: Test required vs optional questions
- [ ] **Completion Logic**: Confirm proper survey completion handling

---

## 3. Question Types Testing

### 3.1 True/False Questions
- [ ] **Question Display**: Verify question text and media display correctly
- [ ] **Answer Selection**: Test both True and False button functionality
- [ ] **Keyboard Navigation**: Use '1' for True, '2' for False, Enter to submit
- [ ] **Feedback Display**: Confirm correct/incorrect feedback shows
- [ ] **Continuation**: Test Continue button after feedback
- [ ] **Mobile Interaction**: Test touch interactions on mobile
- [ ] **Helper Text**: Verify keyboard helper text hides on mobile

### 3.2 Multiple Choice Questions (UnifiedQuestionNode)
- [ ] **Question Display**: Verify question text, content, and media
- [ ] **Choice Selection**: Test all answer choice buttons
- [ ] **Keyboard Navigation**: Use number keys (1-9) for selection
- [ ] **Feedback System**: Verify correct/incorrect feedback
- [ ] **Choice Highlighting**: Confirm selected choice is highlighted
- [ ] **Submit/Continue**: Test submit and continue button flow
- [ ] **Mobile Responsive**: Test on various screen sizes

### 3.3 Ordering Questions
- [ ] **Item Display**: Verify all ordering items are shown
- [ ] **Drag and Drop**: Test dragging items to reorder
- [ ] **Visual Feedback**: Confirm drag indicators and drop zones
- [ ] **Order Validation**: Test correct and incorrect order submissions
- [ ] **Feedback Display**: Verify correct order shown in feedback
- [ ] **Continue Button**: Test manual continue after feedback
- [ ] **Mobile Drag**: Test drag-and-drop on touch devices

### 3.4 Matching Questions
- [ ] **Item Display**: Verify left and right column items
- [ ] **Click Matching**: Test clicking items to create matches
- [ ] **Visual Connections**: Confirm connection lines display
- [ ] **Keyboard Navigation**: Test arrow keys, Enter/Space, Tab switching
- [ ] **Match Validation**: Test correct and incorrect matches
- [ ] **Clear Matches**: Test Escape key to clear, Delete to remove
- [ ] **Continue Button**: Test manual continue after completion
- [ ] **Mobile Matching**: Test touch interactions on mobile

### 3.5 Likert Scale Questions
- [ ] **Scale Display**: Verify scale labels (min, middle, max)
- [ ] **Value Selection**: Test all scale values (1-5, 1-7, 1-10)
- [ ] **Keyboard Navigation**: Test number keys and arrow keys
- [ ] **Required Validation**: Test required vs optional questions
- [ ] **Submit Logic**: Test submit with and without selection
- [ ] **Visual Feedback**: Confirm selected value highlighting
- [ ] **Mobile Scales**: Test scale interaction on mobile devices

### 3.6 Rating Questions
- [ ] **Star Rating**: Test star rating selection and display
- [ ] **Numeric Rating**: Test numeric button selection
- [ ] **Categorical Rating**: Test categorical option selection
- [ ] **Keyboard Controls**: Test number key selection
- [ ] **Half Stars**: Test half-star ratings if enabled
- [ ] **Value Display**: Verify value display when enabled
- [ ] **Required Validation**: Test required field validation

### 3.7 Matrix Questions
- [ ] **Grid Display**: Verify matrix grid layout
- [ ] **Cell Selection**: Test selecting values in grid cells
- [ ] **Row/Column Headers**: Confirm proper header display
- [ ] **Required Validation**: Test required row validation
- [ ] **Submit Logic**: Test partial vs complete submissions
- [ ] **Mobile Matrix**: Test matrix interaction on mobile
- [ ] **Responsive Design**: Test grid responsiveness

### 3.8 Slider Questions
- [ ] **Slider Display**: Verify slider with proper range
- [ ] **Value Selection**: Test slider drag and click
- [ ] **Value Display**: Confirm current value display
- [ ] **Range Validation**: Test min/max value constraints
- [ ] **Step Values**: Test step increment functionality
- [ ] **Keyboard Control**: Test arrow keys for slider adjustment
- [ ] **Mobile Slider**: Test touch slider interaction

### 3.9 Text Area Questions
- [ ] **Text Input**: Test long-form text entry
- [ ] **Character Counting**: Test character count display
- [ ] **Length Validation**: Test minimum/maximum length validation
- [ ] **Required Validation**: Test required field validation
- [ ] **Placeholder Text**: Verify placeholder text display
- [ ] **Text Formatting**: Test text formatting preservation
- [ ] **Mobile Text**: Test text input on mobile keyboards

### 3.10 Short Answer Questions
- [ ] **Text Input**: Test short text entry
- [ ] **Validation**: Test answer validation logic
- [ ] **Required Fields**: Test required vs optional fields
- [ ] **Placeholder Text**: Verify placeholder display
- [ ] **Submit Logic**: Test submit with valid/invalid answers
- [ ] **Mobile Input**: Test mobile keyboard integration

---

## 4. Media Integration Testing

### 4.1 Image Media
- [ ] **Image Display**: Test image rendering in questions
- [ ] **Image Loading**: Verify loading states and error handling
- [ ] **Image Sizing**: Test responsive image sizing
- [ ] **Alt Text**: Verify accessibility alt text
- [ ] **Multiple Images**: Test questions with multiple images
- [ ] **Mobile Images**: Test image display on mobile devices

### 4.2 Video Media
- [ ] **Video Playback**: Test video player functionality
- [ ] **Video Controls**: Test play, pause, volume controls
- [ ] **Video Loading**: Test video loading states
- [ ] **Mobile Video**: Test video playback on mobile
- [ ] **Video Formats**: Test different video formats (mp4, webm)
- [ ] **Error Handling**: Test broken video links

### 4.3 Audio Media
- [ ] **Audio Playback**: Test audio player functionality
- [ ] **Audio Controls**: Test play, pause, volume controls
- [ ] **Audio Loading**: Test audio loading states
- [ ] **Mobile Audio**: Test audio playback on mobile
- [ ] **Audio Formats**: Test different audio formats
- [ ] **Background Audio**: Test audio with other app sounds

---

## 5. Navigation & Flow Testing

### 5.1 Question Progression
- [ ] **Linear Flow**: Test normal question-to-question progression
- [ ] **Branching Logic**: Test conditional question paths
- [ ] **Variable Tracking**: Test variable-based navigation
- [ ] **Progress Indicators**: Verify progress bar updates
- [ ] **Back Navigation**: Test if back navigation is blocked properly
- [ ] **Deep Linking**: Test URL-based navigation (if applicable)

### 5.2 Scenario Completion
- [ ] **Completion Detection**: Test scenario completion logic
- [ ] **Results Display**: Verify final results screen
- [ ] **Score Calculation**: Test scoring for quiz scenarios
- [ ] **Completion Analytics**: Test xAPI completion events
- [ ] **Restart Functionality**: Test restarting completed scenarios
- [ ] **Exit Handling**: Test exiting mid-scenario

### 5.3 Error Handling
- [ ] **Network Errors**: Test offline/connection issues
- [ ] **File Errors**: Test corrupted or invalid files
- [ ] **Runtime Errors**: Test JavaScript errors and recovery
- [ ] **Error Messages**: Verify user-friendly error messages
- [ ] **Error Logging**: Test error logging and debugging
- [ ] **Graceful Degradation**: Test fallback behaviors

---

## 6. xAPI Integration Testing

### 6.1 Event Tracking
- [ ] **Activity Started**: Test activity start events
- [ ] **Question Answered**: Test question interaction events
- [ ] **Activity Completed**: Test completion events
- [ ] **Time Tracking**: Test duration and timing data
- [ ] **Score Tracking**: Test score and performance data
- [ ] **Attempt Tracking**: Test attempt counting

### 6.2 Analytics Data
- [ ] **Event Log**: Verify event log display in results
- [ ] **Statement Structure**: Test xAPI statement format
- [ ] **Actor Information**: Test user identification
- [ ] **Verb Usage**: Test appropriate xAPI verbs
- [ ] **Result Data**: Test score and completion data
- [ ] **Context Data**: Test additional context information

---

## 7. Accessibility Testing

### 7.1 Keyboard Navigation
- [ ] **Tab Navigation**: Test tab order through all elements
- [ ] **Keyboard Shortcuts**: Test all documented keyboard shortcuts
- [ ] **Focus Indicators**: Verify visible focus indicators
- [ ] **Screen Reader**: Test with screen reader software
- [ ] **Escape Key**: Test escape key functionality
- [ ] **Enter Key**: Test enter key for submissions

### 7.2 Mobile Accessibility
- [ ] **Touch Targets**: Test touch target sizes (44px minimum)
- [ ] **Swipe Gestures**: Test swipe navigation if applicable
- [ ] **Keyboard Helper**: Verify keyboard helpers hide on mobile
- [ ] **Voice Control**: Test voice control compatibility
- [ ] **Orientation**: Test portrait/landscape orientation
- [ ] **Zoom**: Test zoom functionality and readability

---

## 8. Performance Testing

### 8.1 Loading Performance
- [ ] **Initial Load**: Test application startup time
- [ ] **File Loading**: Test large file loading performance
- [ ] **Media Loading**: Test media loading and caching
- [ ] **Memory Usage**: Monitor memory usage during testing
- [ ] **Smooth Animations**: Test animation performance
- [ ] **Responsive Interactions**: Test interaction response times

### 8.2 Stress Testing
- [ ] **Large Scenarios**: Test with 100+ question scenarios
- [ ] **Multiple Media**: Test scenarios with extensive media
- [ ] **Long Sessions**: Test extended usage sessions
- [ ] **Memory Leaks**: Test for memory leaks over time
- [ ] **Browser Limits**: Test browser storage limits
- [ ] **Concurrent Users**: Test multiple browser tabs/windows

---

## 9. Cross-Platform Testing

### 9.1 Browser Compatibility
- [ ] **Chrome**: Test in Chrome (latest)
- [ ] **Firefox**: Test in Firefox (latest)
- [ ] **Safari**: Test in Safari (latest)
- [ ] **Edge**: Test in Microsoft Edge (latest)
- [ ] **Mobile Chrome**: Test on mobile Chrome
- [ ] **Mobile Safari**: Test on mobile Safari

### 9.2 Device Testing
- [ ] **Desktop**: Test on desktop computers
- [ ] **Tablet**: Test on tablets (iPad, Android)
- [ ] **Mobile**: Test on mobile phones (iOS, Android)
- [ ] **Different Screen Sizes**: Test various screen resolutions
- [ ] **Touch vs Mouse**: Test both input methods
- [ ] **Orientation Changes**: Test device rotation

---

## 10. Specific Workflow Testing

### 10.1 NLJ Training Scenario Workflow
1. [ ] Load FSA sales training NLJ scenario
2. [ ] Progress through all question types
3. [ ] Test branching based on answers
4. [ ] Verify scoring and feedback
5. [ ] Complete scenario and view results
6. [ ] Test restart functionality

### 10.2 Trivie Quiz Workflow
1. [ ] Upload Trivie Excel file
2. [ ] Verify conversion to NLJ format
3. [ ] Answer all quiz questions
4. [ ] Test time tracking (if applicable)
5. [ ] Review final score and feedback
6. [ ] Test quiz retaking

### 10.3 Survey Workflow
1. [ ] Load automotive survey template
2. [ ] Answer all survey questions
3. [ ] Test required vs optional questions
4. [ ] Skip questions where allowed
5. [ ] Complete survey and view summary
6. [ ] Test data export (if applicable)

---

## Test Execution Guidelines

### Test Execution Order
1. **Core Functionality**: Start with basic application loading and navigation
2. **Question Types**: Test each question type thoroughly
3. **Integration**: Test complete workflows and scenarios
4. **Edge Cases**: Test error conditions and boundary cases
5. **Performance**: Test under load and stress conditions
6. **Accessibility**: Test keyboard navigation and screen readers

### Bug Reporting
When issues are found, document:
- [ ] **Steps to Reproduce**: Detailed reproduction steps
- [ ] **Expected Behavior**: What should happen
- [ ] **Actual Behavior**: What actually happens
- [ ] **Environment**: Browser, device, screen size
- [ ] **Severity**: Critical, High, Medium, Low
- [ ] **Screenshots**: Visual evidence of issues

### Test Results Documentation
- [ ] **Test Summary**: Overall results and pass/fail rates
- [ ] **Issue Log**: List of all identified issues
- [ ] **Performance Notes**: Performance observations
- [ ] **Recommendations**: Suggested improvements
- [ ] **Retest Plan**: Plan for retesting fixed issues

---

## Quick Smoke Test Checklist

For rapid testing, use this abbreviated checklist:

### Essential Functions (5 minutes)
- [ ] Application loads successfully
- [ ] Can load a sample NLJ scenario
- [ ] Can answer a multiple choice question
- [ ] Can answer a true/false question
- [ ] Theme toggle works
- [ ] Sound toggle works
- [ ] Scenario completes successfully

### Question Types (10 minutes)
- [ ] Multiple choice works
- [ ] True/false works
- [ ] Ordering works (drag and drop)
- [ ] Matching works (click to connect)
- [ ] Likert scale works
- [ ] Rating works
- [ ] All feedback displays correctly

### Mobile Testing (5 minutes)
- [ ] Loads on mobile device
- [ ] Touch interactions work
- [ ] Keyboard helpers hide on mobile
- [ ] Responsive design works
- [ ] Media displays correctly

This comprehensive checklist ensures thorough testing of all NLJ Viewer functionality across different scenarios, devices, and use cases.