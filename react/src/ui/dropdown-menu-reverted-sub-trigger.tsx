import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function DropdownMenuRevertedSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 gap-2",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      {children}
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export { DropdownMenuRevertedSubTrigger };
