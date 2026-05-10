import type { TabItem } from "@/types";

export function reorderTabsByIndex(
  tabs: TabItem[],
  fromIndex: number,
  toIndex: number
): TabItem[] | null {
  const orderedTabs = [...tabs].sort((left, right) => left.position - right.position);

  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= orderedTabs.length ||
    toIndex >= orderedTabs.length ||
    fromIndex === toIndex
  ) {
    return null;
  }

  const [movedTab] = orderedTabs.splice(fromIndex, 1);
  if (!movedTab) {
    return null;
  }

  orderedTabs.splice(toIndex, 0, movedTab);
  return orderedTabs.map((tab, index) => ({
    ...tab,
    position: index,
  }));
}
