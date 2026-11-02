"use client";

import React, { useState } from "react";
import { PlusSignIcon } from "@strange-huge/icons";
import { IconButton } from "@/components/ui/button";
import { Dropdown } from "@/components/Dropdown";
import type { ComposerButtonSize } from "./composer-sizes";

interface AddMenuButtonProps {
  /** Opens this in a Dropdown.Float when set; otherwise the button calls `onAdd`. */
  addMenu?: React.ReactNode;
  onAdd?: () => void;
  disabled: boolean;
  size: ComposerButtonSize;
}

/** The leading `+` (Add attachment) button, with its menu when the host gives one. */
export function AddMenuButton({ addMenu, onAdd, disabled, size }: AddMenuButtonProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  return (
    <div style={{ flexShrink: 0 }}>
      {addMenu !== undefined ? (
        <Dropdown.Float
          open={addMenuOpen}
          onOpenChange={setAddMenuOpen}
          placement="top-start"
          trigger={
            <IconButton
              variant="ghost"
              size={size}
              icon={<PlusSignIcon size={20} />}
              aria-label="Add attachment"
              disabled={disabled}
            />
          }
        >
          {/* Presentational wrapper (role="none" so it adds nothing to the menu tree): a
              bubbled click/Enter/Space activation from any of addMenu's own menu items
              closes the dropdown immediately. The items keep their menuitem semantics. */}
          <div role="none" onClick={() => setAddMenuOpen(false)}>
            {addMenu}
          </div>
        </Dropdown.Float>
      ) : (
        <IconButton
          variant="ghost"
          size={size}
          icon={<PlusSignIcon size={20} />}
          aria-label="Add attachment"
          onClick={onAdd}
          disabled={disabled}
        />
      )}
    </div>
  );
}
