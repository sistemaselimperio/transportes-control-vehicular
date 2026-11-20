"use client";

import { ActionForm } from "@/components/app/action-form";
import { createClientAction } from "../application/client-actions";
import { ClientFields } from "./client-fields";

/** Creates a client; editing happens in place inside the client sheet. */
export function ClientForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  return (
    <ActionForm action={createClientAction} submitLabel="Crear cliente" onDone={onDone} onCancel={onCancel}>
      <ClientFields />
    </ActionForm>
  );
}
