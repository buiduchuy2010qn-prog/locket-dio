import clsx from "clsx";
import { getAvatarOrFallback } from "@/utils";

export function GroupAvatarStack({ members }) {
  return (
    <div className="relative w-full h-full rounded-full overflow-hidden">
      {members.map((member, index) => (
        <img
          key={member.uid}
          src={getAvatarOrFallback(member.profilePic)}
          alt=""
          className={clsx(
            "absolute w-6 h-6 rounded-full object-cover border-2 border-base-100",
            getPosition(members.length, index),
          )}
        />
      ))}
    </div>
  );
}

const getPosition = (count, index) => {
  if (count === 1) return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";

  if (count === 2)
    return [
      "top-1/2 left-1 -translate-y-1/2",
      "top-1/2 right-1 -translate-y-1/2",
    ][index];

  if (count === 3)
    return [
      "top-1 left-1/2 -translate-x-1/2",
      "bottom-1 left-1",
      "bottom-1 right-1",
    ][index];

  if (count === 4)
    return [
      "top-1 left-1",
      "top-1 right-1",
      "bottom-1 left-1",
      "bottom-1 right-1",
    ][index];

  return [
    "top-0 left-1/2 -translate-x-1/2",
    "top-3 left-0",
    "top-3 right-0",
    "bottom-0 left-1",
    "bottom-0 right-1",
  ][index];
};
