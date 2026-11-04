"use client";

import { useState } from "react";
import { Field } from "@/components/app/action-form";
import { NativeSelect } from "@/components/ui/native-select";
import { DEPARTMENTS, findMunicipality, municipalityLabel } from "@/modules/shared/domain/municipalities";

/** New vehicles start on Boyacá, where most of the fleet is registered. */
const DEFAULT_DEPARTMENT = "15";

/**
 * Department + municipality selects. The municipality list follows the chosen
 * department; the form submits the municipality label under `name`.
 */
export function MunicipalityPicker({
  idPrefix,
  defaultValue,
  selectClassName,
  name = "municipality",
  departmentLabel = "Departamento",
  municipalityLabelText = "Municipio",
  required,
}: {
  idPrefix: string;
  defaultValue?: string | null;
  selectClassName?: string;
  /** Name of the hidden input that carries the municipality label. */
  name?: string;
  departmentLabel?: string;
  municipalityLabelText?: string;
  required?: boolean;
}) {
  const initial = findMunicipality(defaultValue ?? null);
  const [department, setDepartment] = useState(initial?.departmentCode ?? (defaultValue ? "" : DEFAULT_DEPARTMENT));
  const [code, setCode] = useState(initial?.code ?? "");
  const cities = DEPARTMENTS.find((d) => d.code === department)?.cities ?? [];
  const legacy = defaultValue && !initial ? defaultValue : null;

  return (
    <>
      <Field label={departmentLabel} htmlFor={`${idPrefix}-dept`}>
        <NativeSelect
          id={`${idPrefix}-dept`}
          className={selectClassName}
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setCode("");
          }}
        >
          <option value="">Sin departamento</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label={municipalityLabelText}
        required={required}
        htmlFor={`${idPrefix}-muni`}
        hint={legacy ? `Valor anterior: ${legacy}. Elige el municipio para corregirlo.` : undefined}
      >
        <NativeSelect
          id={`${idPrefix}-muni`}
          className={selectClassName}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={cities.length === 0}
        >
          <option value="">Sin municipio</option>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <input type="hidden" name={name} value={(code && municipalityLabel(code)) || ""} />
    </>
  );
}
