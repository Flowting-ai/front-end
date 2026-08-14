/**
 * Shared contract for dragging a pin card out of the Pinboard and dropping it
 * onto the chat input. Kept in its own tiny module (rather than defined inside
 * Pinboard or ChatInput) so neither side has to import the other's — large —
 * component module just to reach a string constant.
 *
 * Payload shape matches `PinMentionable` (src/components/chat/PinMentionDropdown.tsx)
 * and what `onInsert` already dispatches as a `pin:insert` CustomEvent (see
 * RightSidebar.tsx's `toPinboardPin`) — dropping a pin and clicking "Insert"
 * both land in ChatInterface.tsx's existing `pin:insert` listener.
 */
export const PIN_DRAG_MIME_TYPE = "application/x-souvenir-pin";

export interface PinDragPayload {
  id: string;
  title: string;
  content: string;
}
