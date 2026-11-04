ONNX Runtime Web 1.20.1 (onnxruntime-web، npm) — فقط نسخه‌ی WebAssembly (ort.wasm.min.mjs و ort-wasm-simd-threaded.*)
مجوز: MIT — Copyright (c) Microsoft Corporation. https://github.com/microsoft/onnxruntime/blob/main/LICENSE
همه‌ی فایل‌ها از خود اپ بارگذاری می‌شن؛ هیچ درخواستی به سرور بیرونی فرستاده نمی‌شه.

مدل‌ها (models/):
- rtmpose-m-halpe26-fp16.onnx: RTMPose-m، ۲۶ نقطه (Halpe26، شش نقطه روی پا)، 256x192، OpenMMLab MMPose
  منبع: https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-body7_pt-body7-halpe26_700e-256x192-4d3e73dd_20230605.zip
  به float16 تبدیل شده (onnxconverter-common، ورودی و خروجی float32)؛ اختلاف نقاط با نسخه‌ی اصلی کمتر از ۰٫۱٪ طول پا.
  مجوز کد و وزن‌های MMPose: Apache License 2.0. ⚠ قبل از عرضه‌ی تجاری: شرایط استفاده‌ی داده‌های آموزش (Body7: COCO، AI Challenger،
  CrowdPose، MPII، sub-JHMDB، Halpe، PoseTrack18) باید جدا بررسی بشه؛ بعضی فقط برای پژوهش منتشر شدن.
- yolox-tiny-humanart-int8.onnx: YOLOX-tiny (تشخیص آدم، آموزش روی Human-Art)، 416x416، از همون مخزن OpenMMLab
  منبع: https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/yolox_tiny_8xb8-300e_humanart-6f3252f9.zip
  کوانتیزه‌ی پویا ۸ بیتی (onnxruntime.quantization)؛ تشخیص روی مجموعه‌ی آزمایش با نسخه‌ی اصلی یکی بود.
  مجوز YOLOX و MMPose: Apache License 2.0؛ ⚠ شرایط داده‌ی Human-Art هم باید بررسی بشه.
