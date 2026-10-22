// The live-region role for a Banner, which Astryx core 0.7 made
// caller-owned.
//
// Core 0.6 derived the role from the status: error/warning -> "alert",
// info/success -> "status". Core 0.7 dropped that derivation — the Banner
// no longer carries a live region unless the caller asks for one — so the
// mapping now lives here, and this app owns it.
//
// It reproduces core 0.6's map exactly, so the upgrade changed no announced
// behaviour: a failed widget still interrupts, a notice still waits its turn.
// Delete this when core reinstates a default; it is a contract with the kit,
// not a preference.

/** The Banner statuses this app renders. */
export type BannerKind = "error" | "warning" | "info" | "success";

/**
 * `role` for a Banner of the given kind.
 *
 * - "alert" interrupts the screen reader: the thing failed, or the data on
 *   screen is no longer live and the reader must know now.
 * - "status" waits for a pause in speech: informational.
 */
export const bannerRole = (kind: BannerKind): "alert" | "status" =>
	kind === "error" || kind === "warning" ? "alert" : "status";
