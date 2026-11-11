import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { libraryApi } from "@/lib/library/api";
import { notifyLibraryFilesChanged } from "@/lib/library/files-changed";
import type { LibraryShare } from "@/lib/library/library-shares";
import { FILE_MESSAGES, MESSAGES } from "@/lib/library/messages";

/**
 * A file shared by asking in chat (`library_shared`): the same "Shared with Maya · Undo" toast the Share
 * dialog shows, as in the prototype. Undo removes that grant; one already gone also reads "Sharing undone".
 */
export function showLibraryShareToast(share: LibraryShare): void {
  toast(FILE_MESSAGES.sharedWith([share.personName]), {
    action: {
      label: FILE_MESSAGES.undo,
      onClick: () => {
        void libraryApi.revokeGrant(share.fileId, share.grantId).then(
          () => {
            toast(FILE_MESSAGES.sharingUndone);
            notifyLibraryFilesChanged();
          },
          (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) toast(FILE_MESSAGES.sharingUndone);
            else toast.error(MESSAGES.shareFailed);
          },
        );
      },
    },
  });
}
