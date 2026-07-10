export function GroupMembersLabel({ members = [] }) {
  if (!members.length) {
    return <span>---</span>;
  }

  const names = members
    .slice(0, 2)
    .map((member) => member?.firstName || member?.username || "Unknown");

  const remainingCount = members.length - names.length;

  return (
    <span>
      {names.join(", ")}
      {remainingCount > 0 && ` và ${remainingCount} người khác`}
    </span>
  );
}
