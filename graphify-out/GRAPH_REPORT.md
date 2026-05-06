# Graph Report - tabsetu  (2026-05-06)

## Corpus Check
- 74 files · ~174,325 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 477 nodes · 1001 edges · 79 communities (63 shown, 16 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 156 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dab7b95e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]

## God Nodes (most connected - your core abstractions)
1. `addToast()` - 48 edges
2. `generateId()` - 17 edges
3. `sanitizeLabel()` - 17 edges
4. `normalizeTabItem()` - 14 edges
5. `isRecord()` - 13 edges
6. `storageSet()` - 13 edges
7. `normalizeStorageData()` - 12 edges
8. `isRestrictedUrl()` - 12 edges
9. `stripHtml()` - 12 edges
10. `asString()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Tab Session` --calls--> `Automation Schedule`  [INFERRED]
  README.md → stitch_tabsetu/tabsetu_mobile_schedules/code.html
- `Tab Session` --references--> `Notes System`  [INFERRED]
  README.md → stitch_tabsetu/tabsetu_mobile_notes/code.html
- `Tab Session` --references--> `Session Share Page`  [EXTRACTED]
  README.md → share-page/index.html
- `isTrackableTab()` --calls--> `isRestrictedUrl()`  [INFERRED]
  src/background/service_worker.ts → src/lib/tabHelpers.ts
- `createScheduleAlarm()` --calls--> `nextMatchingDate()`  [INFERRED]
  src/background/service_worker.ts → src/lib/alarmScheduling.ts

## Hyperedges (group relationships)
- **TabSetu Mobile Experience** — mobile_ui_home, mobile_ui_folders, schedule_concept, note_concept [EXTRACTED 1.00]

## Communities (79 total, 16 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (47): persistNotes(), sanitizeNoteUpdates(), persistShareLinks(), asBoolean(), asNullableNumber(), asNullableString(), asNumber(), asString() (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (36): addToast(), clearToast(), desktopViewFromDashView(), getInitialDashView(), handleCollapseSaved(), isMobileNavView(), onKeyDown(), openSaveModal() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (42): chooseMostRecent(), chooseSessionWinner(), collectJsonSections(), containerName(), copyLinksToClipboard(), createImportedSession(), createImportedTab(), decodeHtmlEntities() (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (24): focusSearch(), handleOpenTab(), if(), openCollapse(), openQuickSave(), handleDelete(), handleOpenSession(), handleOpenTab() (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (23): countSelectedVisibleTabs(), filterCapturableTabs(), isCapturableChromeTab(), handleAddCurrentTab(), snapshotTabToTabItem(), handleAddActiveTab(), defaultSavedSessionTitle(), displaySessionTitle() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (25): alarmName(), clearStoredBrowserTab(), createScheduleAlarm(), createSessionFromWindow(), findFallbackBrowserTab(), handleReminderAlarm(), hydrateAlarms(), importSharedSession() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.19
Nodes (18): createOneTimeScheduleForTab(), defaultScheduleDraft(), formatScheduleLabel(), handleDeleteSession(), handleEditSchedule(), handleSaveDetails(), handleSaveSchedule(), handleTabDrop() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.21
Nodes (11): createTabFromUrl(), currentTimeInputValue(), formatScheduleLabel(), handleSubmit(), previewSchedule(), todayInputValue(), updateDraft(), normalizeScheduleDraft() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (12): applyMatch(), buildFuseOptions(), buildSearchIndex(), buildSnippets(), createEmptyHighlights(), normalizeRanges(), searchSessions(), setMappedRanges() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.32
Nodes (8): allowedScheduleDays(), createLocalDate(), nextMatchingDate(), parseScheduleTime(), alarmName(), persistSchedules(), replaceBrowserAlarms(), syncScheduleAlarm()

### Community 10 - "Community 10"
Cohesion: 0.45
Nodes (9): clearReminder(), dismissReminder(), getDomainLabel(), reminderAlarmName(), reopenReminder(), scheduleReminderAlarm(), snoozeReminder(), tomorrowMorning() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.44
Nodes (7): formatClock(), formatReminderDate(), isReminderInPastWindow(), isReminderPast(), oneHourFromNow(), startOfDay(), tomorrowAtNine()

### Community 12 - "Community 12"
Cohesion: 0.53
Nodes (7): createShareSnapshot(), decodeShareSnapshot(), encodeShareSnapshot(), fromBase64Url(), generateShareUrl(), generateShareUrlFromEncoded(), toBase64Url()

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (6): fromBase64Url(), importSnapshotIntoTabSetu(), openSnapshotTabs(), readSnapshot(), renderError(), setText()

### Community 14 - "Community 14"
Cohesion: 0.52
Nodes (5): autoArchiveSessions(), bumpSessionVersion(), persistSessions(), reindexTabs(), touchSession()

### Community 15 - "Community 15"
Cohesion: 0.53
Nodes (4): getDomain(), handleSaveSelected(), toggleAll(), toggleSelect()

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (4): advance(), finish(), getSpotlightRect(), updateSpotlight()

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (6): Folder Container, Notes System, Automation Schedule, Tab Session, Session Share Page, TabSetu Core

### Community 18 - "Community 18"
Cohesion: 0.6
Nodes (3): handleKeyDown(), normalizeDesktopView(), openSessionDetail()

### Community 19 - "Community 19"
Cohesion: 0.7
Nodes (3): makeImportFile(), makeSession(), makeTab()

### Community 20 - "Community 20"
Cohesion: 0.6
Nodes (3): formatDateTime(), formatRelativeCount(), formatScheduleLabel()

### Community 21 - "Community 21"
Cohesion: 0.7
Nodes (3): applyTheme(), resolveTheme(), subscribeToSystemTheme()

### Community 25 - "Community 25"
Cohesion: 0.5
Nodes (4): Main Dashboard, Glassmorphism UI, Mobile Home Screen, Extension Popup

## Knowledge Gaps
- **10 isolated node(s):** `TabSetu Core`, `Folder Container`, `Automation Schedule`, `Notes System`, `Deployment Process` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `addToast()` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 10`, `Community 15`?**
  _High betweenness centrality (0.207) - this node is a cross-community bridge._
- **Why does `isRestrictedUrl()` connect `Community 4` to `Community 3`, `Community 5`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `loadStorage()` connect `Community 0` to `Community 1`, `Community 5`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `addToast()` (e.g. with `handleExportAll()` and `handleImport()`) actually correct?**
  _`addToast()` has 42 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `generateId()` (e.g. with `createSessionFromWindow()` and `snapshotTabToTabItem()`) actually correct?**
  _`generateId()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `sanitizeLabel()` (e.g. with `snapshotTabToTabItem()` and `importSharedSession()`) actually correct?**
  _`sanitizeLabel()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `normalizeTabItem()` (e.g. with `isValidUrl()` and `generateId()`) actually correct?**
  _`normalizeTabItem()` has 5 INFERRED edges - model-reasoned connections that need verification._