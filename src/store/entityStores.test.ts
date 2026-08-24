import { describe, expect, it } from "vitest";
import { useFolderStore } from "@/store/folderStore";
import { useNotesStore } from "@/store/notesStore";
import { useScheduleStore } from "@/store/scheduleStore";
import { useShareStore } from "@/store/shareStore";
import { useTagStore } from "@/store/tagStore";

describe("entity stores", () => {
  it("sanitizes and manages folders, tags, notes, schedules, and share links", () => {
    useFolderStore.getState().importFolders([]);
    useTagStore.getState().importTags([]);
    useNotesStore.getState().importNotes([]);
    useScheduleStore.getState().importSchedules([]);
    useShareStore.getState().importShareLinks([]);

    useFolderStore.getState().createFolder("<b>Work</b>", "#123456", "briefcase");
    const folder = useFolderStore.getState().folders[0];
    useFolderStore.getState().updateFolder(folder.id, { name: "<i>Projects</i>" });
    expect(useFolderStore.getState().folders[0]?.name).toBe("Projects");

    useTagStore.getState().createTag("<b>Roadmap! 🚀</b>", "#abcdef");
    const tag = useTagStore.getState().tags[0];
    expect(tag.name).toBe("Roadmap ");
    useTagStore.getState().updateTag(tag.id, { name: "Priority!" });
    expect(useTagStore.getState().tags[0]?.name).toBe("Priority");

    const note = useNotesStore
      .getState()
      .createNote("<b>Ideas</b>", "<script>unsafe</script>Safe", [tag.id], "#fff");
    useNotesStore.getState().updateNote(note.id, { content: "<b>Updated</b>" });
    expect(useNotesStore.getState().standaloneNotes[0]).toMatchObject({
      title: "Ideas",
      content: "Updated",
    });

    useScheduleStore.getState().createSchedule({
      sessionId: "session-a",
      type: "daily",
      time: "09:00",
      daysOfWeek: [],
      date: null,
      enabled: true,
    });
    const schedule = useScheduleStore.getState().schedules[0];
    useScheduleStore.getState().toggleSchedule(schedule.id, false);
    useScheduleStore.getState().updateSchedule(schedule.id, { time: "10:00" });
    expect(useScheduleStore.getState().schedules[0]).toMatchObject({
      enabled: false,
      time: "10:00",
    });
    const firstLink = useShareStore.getState().createShareLink("session-a", "first");
    const secondLink = useShareStore.getState().createShareLink("session-a", "second");
    expect(secondLink.id).not.toBe(firstLink.id);
    expect(useShareStore.getState().shareLinks).toHaveLength(1);

    useFolderStore.getState().deleteFolder(folder.id);
    useTagStore.getState().deleteTag(tag.id);
    useNotesStore.getState().deleteNote(note.id);
    useScheduleStore.getState().deleteSchedule(schedule.id);
    useShareStore.getState().clearShareLinks();

    expect(useFolderStore.getState().folders).toEqual([]);
    expect(useTagStore.getState().tags).toEqual([]);
    expect(useNotesStore.getState().standaloneNotes).toEqual([]);
    expect(useScheduleStore.getState().schedules).toEqual([]);
    expect(useShareStore.getState().shareLinks).toEqual([]);
  });
});
