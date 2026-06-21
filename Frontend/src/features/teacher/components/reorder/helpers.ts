export function getLessonContainerId(chapterId: string): string {
  return `lesson:${chapterId}`;
}

export function assertValidOrder(clientIds: string[], serverIds: string[]): boolean {
  if (clientIds.length !== serverIds.length) return false;
  if (new Set(clientIds).size !== clientIds.length) return false;

  const serverSet = new Set(serverIds);
  return clientIds.every((id) => serverSet.has(id));
}
