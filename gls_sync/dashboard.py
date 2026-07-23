from dataclasses import replace

from gls_sync.config import Settings


def status_text(controller) -> str:
    if controller.last_synced_at is None:
        last_sync_line = "Laatste update: nog niet uitgevoerd"
    else:
        stamp = controller.last_synced_at.strftime("%d-%m-%Y %H:%M:%S")
        result = controller.last_result
        if result is not None and result.error:
            last_sync_line = f"Laatste update: {stamp} (MISLUKT: {result.error})"
        else:
            last_sync_line = f"Laatste update: {stamp}"

    return (
        f"Klaar om te importeren: {controller.pending_count()}\n"
        f"Moet gecontroleerd worden: {controller.needs_review_count()}\n"
        f"{last_sync_line}"
    )


def settings_from_form(
    current: Settings,
    weight_kg: str,
    interval_minutes: str,
    run_at_startup: bool,
    labellite_path: str,
) -> Settings:
    return replace(
        current,
        weight_kg=float(weight_kg),
        interval_minutes=int(interval_minutes),
        run_at_startup=run_at_startup,
        labellite_path=labellite_path.strip(),
    )


def show_dashboard(controller) -> None:
    import tkinter as tk
    from tkinter import filedialog, messagebox

    root = tk.Tk()
    root.title("GLS Sync")
    root.resizable(False, False)

    status_var = tk.StringVar()

    def refresh_status():
        status_var.set(status_text(controller))

    status_label = tk.Label(
        root, textvariable=status_var, justify="left", anchor="w", font=("Segoe UI", 11)
    )
    status_label.pack(fill="x", padx=16, pady=(16, 8))

    def on_download_orders():
        controller.sync_now()
        refresh_status()

    def on_open_folder():
        import subprocess

        subprocess.Popen(["explorer", str(controller.base_dir)])

    def on_mark_imported():
        archived = controller.mark_as_imported()
        refresh_status()
        if archived is None:
            messagebox.showinfo("GLS Sync", "Er is niets klaar om als geïmporteerd te markeren.")
        else:
            messagebox.showinfo("GLS Sync", f"Gearchiveerd naar:\n{archived}")

    button_frame = tk.Frame(root)
    button_frame.pack(fill="x", padx=16, pady=(0, 12))
    button_style = {"width": 22, "font": ("Segoe UI", 10), "pady": 6}
    tk.Button(button_frame, text="Bestellingen ophalen", command=on_download_orders, **button_style).pack(
        fill="x", pady=3
    )
    tk.Button(button_frame, text="Map openen", command=on_open_folder, **button_style).pack(fill="x", pady=3)
    tk.Button(
        button_frame, text="Als geïmporteerd markeren", command=on_mark_imported, **button_style
    ).pack(fill="x", pady=3)

    settings_frame = tk.LabelFrame(root, text="Instellingen", font=("Segoe UI", 10, "bold"))
    settings_frame.pack(fill="x", padx=16, pady=(0, 16))

    tk.Label(settings_frame, text="Gewicht per pakket (kg)").grid(
        row=0, column=0, sticky="e", padx=(8, 4), pady=4
    )
    weight_entry = tk.Entry(settings_frame, width=10)
    weight_entry.insert(0, str(controller.settings.weight_kg))
    weight_entry.grid(row=0, column=1, sticky="w", padx=(0, 8), pady=4)

    tk.Label(settings_frame, text="Elke hoeveel minuten controleren").grid(
        row=1, column=0, sticky="e", padx=(8, 4), pady=4
    )
    interval_entry = tk.Entry(settings_frame, width=10)
    interval_entry.insert(0, str(controller.settings.interval_minutes))
    interval_entry.grid(row=1, column=1, sticky="w", padx=(0, 8), pady=4)

    tk.Label(settings_frame, text="Pad naar GLS Label Lite (optioneel)").grid(
        row=2, column=0, sticky="e", padx=(8, 4), pady=4
    )
    labellite_entry = tk.Entry(settings_frame, width=32)
    labellite_entry.insert(0, controller.settings.labellite_path)
    labellite_entry.grid(row=2, column=1, sticky="w", padx=(0, 4), pady=4)

    def on_browse_labellite():
        path = filedialog.askopenfilename(
            title="Kies LabelLite.exe", filetypes=[("Programma", "*.exe"), ("Alle bestanden", "*.*")]
        )
        if path:
            labellite_entry.delete(0, tk.END)
            labellite_entry.insert(0, path)

    tk.Button(settings_frame, text="Bladeren...", command=on_browse_labellite).grid(
        row=2, column=2, sticky="w", padx=(0, 8), pady=4
    )

    startup_var = tk.BooleanVar(value=controller.settings.run_at_startup)
    tk.Checkbutton(
        settings_frame, text="Automatisch starten bij het opstarten van Windows", variable=startup_var
    ).grid(row=3, column=0, columnspan=3, sticky="w", padx=8, pady=(4, 8))

    def on_save_settings():
        try:
            new_settings = settings_from_form(
                controller.settings,
                weight_entry.get(),
                interval_entry.get(),
                startup_var.get(),
                labellite_entry.get(),
            )
        except ValueError:
            messagebox.showerror(
                "GLS Sync", "Gewicht moet een getal zijn en het interval moet een heel aantal minuten zijn."
            )
            return
        controller.update_settings(new_settings)
        messagebox.showinfo("GLS Sync", "Instellingen opgeslagen.")

    tk.Button(settings_frame, text="Instellingen opslaan", command=on_save_settings).grid(
        row=4, column=0, columnspan=3, pady=(0, 8)
    )

    refresh_status()
    root.mainloop()
