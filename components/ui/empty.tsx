import * as React from "react";
import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-[160px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/10 p-6 text-center",
        className
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col items-center gap-2", className)} {...props} />;
}

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "icon";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md text-muted-foreground",
        variant === "icon" ? "size-10 border bg-background" : "size-12",
        className
      )}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium", className)} {...props} />;
}

function EmptyDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("max-w-sm text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />;
}

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
};
