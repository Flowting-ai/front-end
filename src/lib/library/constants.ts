// Small constants shared by the app and the mock. Kept out of mock/fixtures.ts so importing the
// viewer id never pulls the sample data into a production bundle.

export const MOCK_VIEWER_ID = "u_you";

/** Files stay in Trash this many days, then are deleted forever (PRD). */
export const TRASH_DAYS = 30;
