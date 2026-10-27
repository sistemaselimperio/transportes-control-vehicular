"use client";

import { Popover } from "@base-ui/react/popover";
import { KeyRound, Phone, UserRound, UserRoundPen, UserRoundPlus, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { InlineAction } from "./vehicle-file-actions";

/** One person in the card: role icon, label over name, and an optional action at the end. */
function PersonRow({
  icon,
  label,
  name,
  empty,
  action,
}: {
  icon: ReactNode;
  label: string;
  name: string | null;
  empty: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`break-words ${name ? "font-medium" : "text-muted-foreground"}`}>
          {name ?? empty}
        </dd>
      </div>
      {action}
    </div>
  );
}

/**
 * Driver and owner behind one small trigger beside the vehicle's brand. Opens on hover for the
 * mouse and on tap or Enter for touch and keyboard, so the details are never hover-only.
 */
export function PeoplePopover({
  driverName,
  driverPhone,
  ownerName,
}: {
  driverName: string | null;
  driverPhone: string | null;
  ownerName: string | null;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={150}
        aria-label="Ver conductor y propietario"
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground md:size-8"
      >
        <UsersRound className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-soft outline-none transition-[opacity,transform] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              Responsables del vehículo
            </Popover.Title>
            <dl className="divide-y text-sm">
              <PersonRow
                icon={<UserRound className="size-4" aria-hidden />}
                label="Conductor"
                name={driverName}
                empty="Sin conductor asignado"
                action={
                  <div className="flex shrink-0 items-center gap-1.5">
                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone}`}
                        aria-label={`Llamar al ${driverPhone}`}
                        title={driverPhone}
                        className="inline-flex size-11 items-center justify-center rounded-md border text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground md:size-8"
                      >
                        <Phone className="size-3.5" aria-hidden />
                      </a>
                    )}
                    <InlineAction action="driver" boxed label={driverName ? "Cambiar conductor" : "Asignar conductor"}>
                      {driverName ? (
                        <UserRoundPen className="size-3.5" aria-hidden />
                      ) : (
                        <UserRoundPlus className="size-3.5" aria-hidden />
                      )}
                    </InlineAction>
                  </div>
                }
              />
              <PersonRow
                icon={<KeyRound className="size-4" aria-hidden />}
                label="Propietario"
                name={ownerName}
                empty="Sin registrar"
              />
            </dl>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
