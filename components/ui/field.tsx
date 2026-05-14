"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <div
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-2"
          : "grid gap-1.5",
        className
      )}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={className} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset className={cn("grid gap-4", className)} {...props} />;
}

function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
  return (
    <legend
      className={cn("text-base font-medium", className)}
      {...props}
    />
  );
}

function FieldSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      className={cn("h-px w-full bg-border", className)}
      {...props}
    />
  );
}

export {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet
};
