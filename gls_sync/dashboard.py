from dataclasses import replace

from gls_sync.config import Settings


def status_text(controller) -> str:
    if controller.last_synced_at is None:
        last_sync_line = "Last sync: never"
    else:
        stamp = controller.last_synced_at.strftime("%Y-%m-%d %H:%M:%S")
        result = controller.last_result
        if result is not None and result.error:
            last_sync_line = f"Last sync: {stamp} (FAILED: {result.error})"
        else:
            last_sync_line = f"Last sync: {stamp}"

    return (
        f"Pending orders ready to import: {controller.pending_count()}\n"
        f"Orders needing review: {controller.needs_review_count()}\n"
        f"{last_sync_line}"
    )


def settings_from_form(
    current: Settings,
    shop_domain: str,
    access_token: str,
    weight_kg: str,
    interval_minutes: str,
    run_at_startup: bool,
) -> Settings:
    return replace(
        current,
        shop_domain=shop_domain.strip(),
        access_token=access_token.strip(),
        weight_kg=float(weight_kg),
        interval_minutes=int(interval_minutes),
        run_at_startup=run_at_startup,
    )


def show_dashboard(controller) -> None:
    import tkinter as tk
    from tkinter import messagebox

    root = tk.Tk()
    root.title("GLS Sync")
    root.resizable(False, False)

    status_var = tk.StringVar()

    def refresh_status():
        status_var.set(status_text(controller))

    status_label = tk.Label(root, textvariable=status_var, justify="left", anchor="w")
    status_label.grid(row=0, column=0, columnspan=2, sticky="w", padx=10, pady=(10, 0))

    def on_sync_now():
        controller.sync_now()
        refresh_status()

    def on_open_folder():
        import subprocess

        subprocess.Popen(["explorer", str(controller.base_dir)])

    def on_mark_imported():
        archived = controller.mark_as_imported()
        refresh_status()
        if archived is None:
            messagebox.showinfo("GLS Sync", "There is nothing pending to mark as imported.")
        else:
            messagebox.showinfo("GLS Sync", f"Archived to {archived}")

    button_row = tk.Frame(root)
    button_row.grid(row=1, column=0, columnspan=2, pady=10)
    tk.Button(button_row, text="Sync now", command=on_sync_now).pack(side="left", padx=5)
    tk.Button(button_row, text="Open import folder", command=on_open_folder).pack(side="left", padx=5)
    tk.Button(button_row, text="Mark as imported", command=on_mark_imported).pack(side="left", padx=5)

    settings_frame = tk.LabelFrame(root, text="Settings")
    settings_frame.grid(row=2, column=0, columnspan=2, sticky="we", padx=10, pady=10)

    tk.Label(settings_frame, text="Shop domain").grid(row=0, column=0, sticky="e")
    domain_entry = tk.Entry(settings_frame, width=40)
    domain_entry.insert(0, controller.settings.shop_domain)
    domain_entry.grid(row=0, column=1, padx=5, pady=2)

    tk.Label(settings_frame, text="Access token").grid(row=1, column=0, sticky="e")
    token_entry = tk.Entry(settings_frame, width=40, show="*")
    token_entry.insert(0, controller.settings.access_token)
    token_entry.grid(row=1, column=1, padx=5, pady=2)

    tk.Label(settings_frame, text="Weight (kg)").grid(row=2, column=0, sticky="e")
    weight_entry = tk.Entry(settings_frame, width=10)
    weight_entry.insert(0, str(controller.settings.weight_kg))
    weight_entry.grid(row=2, column=1, sticky="w", padx=5, pady=2)

    tk.Label(settings_frame, text="Check every (minutes)").grid(row=3, column=0, sticky="e")
    interval_entry = tk.Entry(settings_frame, width=10)
    interval_entry.insert(0, str(controller.settings.interval_minutes))
    interval_entry.grid(row=3, column=1, sticky="w", padx=5, pady=2)

    startup_var = tk.BooleanVar(value=controller.settings.run_at_startup)
    tk.Checkbutton(settings_frame, text="Run at Windows startup", variable=startup_var).grid(
        row=4, column=0, columnspan=2, sticky="w", padx=5
    )

    def on_save_settings():
        try:
            new_settings = settings_from_form(
                controller.settings,
                domain_entry.get(),
                token_entry.get(),
                weight_entry.get(),
                interval_entry.get(),
                startup_var.get(),
            )
        except ValueError:
            messagebox.showerror("GLS Sync", "Weight must be a number and interval must be whole minutes.")
            return
        controller.update_settings(new_settings)
        messagebox.showinfo("GLS Sync", "Settings saved.")

    tk.Button(settings_frame, text="Save settings", command=on_save_settings).grid(
        row=5, column=0, columnspan=2, pady=(5, 5)
    )

    refresh_status()
    root.mainloop()
