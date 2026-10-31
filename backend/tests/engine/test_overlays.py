def test_overlay_descriptors_are_framework_independent() -> None:
    from io import BytesIO

    from PIL import Image

    from app.engine.ingestion import ingest_uploads
    from app.engine.overlays import create_overlay_descriptors

    image = BytesIO()
    Image.new("RGB", (4, 3), color=(100, 100, 100)).save(image, format="PNG")
    ingestion = ingest_uploads(
        rgb_filename="rgb.png",
        rgb_media_type="image/png",
        rgb_bytes=image.getvalue(),
        thermal_filename="thermal.csv",
        thermal_media_type="text/csv",
        thermal_bytes=b"30,31\n32,34\n",
        thermal_unit="celsius",
    )
    descriptors = create_overlay_descriptors(ingestion)

    assert {descriptor["name"] for descriptor in descriptors} == {
        "rgb_source",
        "thermal_preview",
        "registration_overlay",
        "anomaly_mask",
        "isotherm_map",
        "final_overlay",
    }
    assert all("mocked" in descriptor for descriptor in descriptors)
    generated = next(item for item in descriptors if item["name"] == "final_overlay")
    assert generated["mocked"] is False
    assert str(generated["data_url"]).startswith("data:image/png;base64,")
