
// debugger;
const data = {
	"client_id": "",
	// 测试数据
	// "prompt": {
	// 	"532": {
	// 		"inputs": {
	// 			"unet_name": "flux1-dev-kontext_fp8_scaled.safetensors",
	// 			"weight_dtype": "fp8_e4m3fn_fast"
	// 		},
	// 		"class_type": "UNETLoader",
	// 		"_meta": {
	// 			"title": "UNet加载器"
	// 		}
	// 	},
	// 	"534": {
	// 		"inputs": {
	// 			"clip_name1": "clip_l.safetensors",
	// 			"clip_name2": "t5xxl_fp8_e4m3fn_scaled.safetensors",
	// 			"type": "flux",
	// 			"device": "default"
	// 		},
	// 		"class_type": "DualCLIPLoader",
	// 		"_meta": {
	// 			"title": "双CLIP加载器"
	// 		}
	// 	},
	// 	"535": {
	// 		"inputs": {
	// 			"vae_name": "ae.safetensors"
	// 		},
	// 		"class_type": "VAELoader",
	// 		"_meta": {
	// 			"title": "加载VAE"
	// 		}
	// 	},
	// 	"536": {
	// 		"inputs": {
	// 			"image": "c09-ai-Camera009 拷贝.jpg"
	// 		},
	// 		"class_type": "LoadImage",
	// 		"_meta": {
	// 			"title": "加载图像"
	// 		}
	// 	},
	// 	"537": {
	// 		"inputs": {
	// 			"rgthree_comparer": {
	// 				"images": [
	// 					{
	// 						"name": "A",
	// 						"selected": true,
	// 						"url": "/api/view?filename=rgthree.compare._temp_oaprp_00013_.png&type=temp&subfolder=&rand=0.7136578731841445"
	// 					},
	// 					{
	// 						"name": "B",
	// 						"selected": true,
	// 						"url": "/api/view?filename=rgthree.compare._temp_oaprp_00014_.png&type=temp&subfolder=&rand=0.3852421390378409"
	// 					}
	// 				]
	// 			},
	// 			"image_a": [
	// 				"720",
	// 				0
	// 			],
	// 			"image_b": [
	// 				"551",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Image Comparer (rgthree)",
	// 		"_meta": {
	// 			"title": "Image Comparer (rgthree)"
	// 		}
	// 	},
	// 	"539": {
	// 		"inputs": {
	// 			"conditioning": [
	// 				"571",
	// 				0
	// 			],
	// 			"latent": [
	// 				"548",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ReferenceLatent",
	// 		"_meta": {
	// 			"title": "ReferenceLatent"
	// 		}
	// 	},
	// 	"542": {
	// 		"inputs": {
	// 			"conditioning": [
	// 				"571",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningZeroOut",
	// 		"_meta": {
	// 			"title": "条件零化"
	// 		}
	// 	},
	// 	"548": {
	// 		"inputs": {
	// 			"batch_size": 1,
	// 			"latent": [
	// 				"549",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "CR Latent Batch Size",
	// 		"_meta": {
	// 			"title": "⚙️ CR Latent Batch Size"
	// 		}
	// 	},
	// 	"549": {
	// 		"inputs": {
	// 			"pixels": [
	// 				"550",
	// 				0
	// 			],
	// 			"vae": [
	// 				"535",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "VAEEncode",
	// 		"_meta": {
	// 			"title": "VAE编码"
	// 		}
	// 	},
	// 	"550": {
	// 		"inputs": {
	// 			"upscale_method": "lanczos",
	// 			"megapixels": 0.3,
	// 			"image": [
	// 				"551",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageScaleToTotalPixels",
	// 		"_meta": {
	// 			"title": "缩放图像（像素）"
	// 		}
	// 	},
	// 	"551": {
	// 		"inputs": {
	// 			"method": "lanczos",
	// 			"image": [
	// 				"1071",
	// 				0
	// 			],
	// 			"width": [
	// 				"552",
	// 				0
	// 			],
	// 			"height": [
	// 				"553",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResize",
	// 		"_meta": {
	// 			"title": "Image Resize"
	// 		}
	// 	},
	// 	"552": {
	// 		"inputs": {
	// 			"expression": "a*8",
	// 			"a": [
	// 				"556",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "MathExpression|pysssss",
	// 		"_meta": {
	// 			"title": "Math Expression 🐍"
	// 		}
	// 	},
	// 	"553": {
	// 		"inputs": {
	// 			"expression": "a*8",
	// 			"a": [
	// 				"554",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "MathExpression|pysssss",
	// 		"_meta": {
	// 			"title": "Math Expression 🐍"
	// 		}
	// 	},
	// 	"554": {
	// 		"inputs": {
	// 			"expression": "a/8",
	// 			"a": [
	// 				"555",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "MathExpression|pysssss",
	// 		"_meta": {
	// 			"title": "Math Expression 🐍"
	// 		}
	// 	},
	// 	"555": {
	// 		"inputs": {
	// 			"image": [
	// 				"1071",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "GetImageSize+",
	// 		"_meta": {
	// 			"title": "🔧 Get Image Size"
	// 		}
	// 	},
	// 	"556": {
	// 		"inputs": {
	// 			"expression": "a/8",
	// 			"a": [
	// 				"555",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "MathExpression|pysssss",
	// 		"_meta": {
	// 			"title": "Math Expression 🐍"
	// 		}
	// 	},
	// 	"557": {
	// 		"inputs": {
	// 			"positive": "Enhance the image with added context, such as cars in motion along the roadway, pedestrians walking on sidewalks and paved surfaces, shrubs, trees, and flowers on the grassy areas, and interior spaces furnished and illuminated with lighting effects. Transform the scene into a serene morning atmosphere, render the text and logo with a soft glow, and apply luminous lighting to buildings and roadways, while preserving the original architectural forms, pavement layout, and paving structure without alteration.\nAdd 4 to 6 vehicles on the roadway, place pedestrians on the sidewalks and at the entrance, incorporate shrubs onto the grassy areas, and apply a diffuse reflection effect to the pavement surface.\nA modern architectural building features a façade covered in large-scale tempered glass curtain walls, with a smooth, mirror-like surface that displays high-precision, physically accurate reflections of the surrounding environment: clearly reflecting flowing cloud layers and silhouettes of adjacent buildings, capturing skylight and urban outlines, while simultaneously revealing soft, uniformly warm yellow interior lighting glowing gently through the glass. The surface reflects the city night scene, streaking headlights, and elongated light trails from street lamps. After rain, the glass becomes wet with fine water droplets, creating slightly blurred reflections and dynamic halos that enhance realism. The glass has visible thickness, with authentic light refraction at the edges, producing optical distortions that convey three-dimensional volume. The building exhibits precise proportions, sharp details, and clean structural lines. The surrounding environment includes urban roads, greenery, and pedestrian silhouettes, all rendered with natural and harmonious lighting. The image is in 8K ultra-high resolution, Cinema 4D style, using PBR materials, global illumination, ray-traced reflections and refractions, with crisp depth of field, sharp details, no noise, and professional photographic visual quality."
	// 		},
	// 		"class_type": "easy positive",
	// 		"_meta": {
	// 			"title": "正面提示词"
	// 		}
	// 	},
	// 	"561": {
	// 		"inputs": {
	// 			"clip_name1": "clip_l.safetensors",
	// 			"clip_name2": "t5xxl_fp8_e4m3fn.safetensors",
	// 			"type": "flux",
	// 			"device": "default"
	// 		},
	// 		"class_type": "DualCLIPLoader",
	// 		"_meta": {
	// 			"title": "双CLIP加载器"
	// 		}
	// 	},
	// 	"563": {
	// 		"inputs": {
	// 			"unet_name": "flux1-dev-fp8.safetensors",
	// 			"weight_dtype": "fp8_e4m3fn_fast"
	// 		},
	// 		"class_type": "UNETLoader",
	// 		"_meta": {
	// 			"title": "UNet加载器"
	// 		}
	// 	},
	// 	"571": {
	// 		"inputs": {
	// 			"clip_l": [
	// 				"572",
	// 				0
	// 			],
	// 			"t5xxl": [
	// 				"572",
	// 				0
	// 			],
	// 			"guidance": 3.5,
	// 			"clip": [
	// 				"725",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "CLIPTextEncodeFlux",
	// 		"_meta": {
	// 			"title": "CLIP文本编码Flux"
	// 		}
	// 	},
	// 	"572": {
	// 		"inputs": {
	// 			"delimiter": ", ",
	// 			"clean_whitespace": "true",
	// 			"text_a": [
	// 				"557",
	// 				0
	// 			],
	// 			"text_b": [
	// 				"762",
	// 				0
	// 			],
	// 			"text_c": [
	// 				"760",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Text Concatenate",
	// 		"_meta": {
	// 			"title": "Text Concatenate"
	// 		}
	// 	},
	// 	"574": {
	// 		"inputs": {
	// 			"model": "gokaygokay/Florence-2-Flux-Large",
	// 			"precision": "fp16",
	// 			"attention": "sdpa",
	// 			"convert_to_safetensors": false
	// 		},
	// 		"class_type": "DownloadAndLoadFlorence2Model",
	// 		"_meta": {
	// 			"title": "DownloadAndLoadFlorence2Model"
	// 		}
	// 	},
	// 	"575": {
	// 		"inputs": {
	// 			"seed": [
	// 				"729",
	// 				0
	// 			],
	// 			"steps": 8,
	// 			"cfg": 1,
	// 			"sampler_name": "euler",
	// 			"scheduler": "simple",
	// 			"denoise": 1,
	// 			"preview_method": "auto",
	// 			"vae_decode": "true",
	// 			"model": [
	// 				"704",
	// 				0
	// 			],
	// 			"positive": [
	// 				"703",
	// 				0
	// 			],
	// 			"negative": [
	// 				"542",
	// 				0
	// 			],
	// 			"latent_image": [
	// 				"635",
	// 				0
	// 			],
	// 			"optional_vae": [
	// 				"535",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "KSampler (Efficient)",
	// 		"_meta": {
	// 			"title": "KSampler (Efficient)"
	// 		}
	// 	},
	// 	"583": {
	// 		"inputs": {
	// 			"PowerLoraLoaderHeaderWidget": {
	// 				"type": "PowerLoraLoaderHeaderWidget"
	// 			},
	// 			"lora_1": {
	// 				"on": false,
	// 				"lora": "FLUX\\建筑摄影质感_v0.1.safetensors",
	// 				"strength": 0.5
	// 			},
	// 			"➕ Add Lora": "",
	// 			"model": [
	// 				"563",
	// 				0
	// 			],
	// 			"clip": [
	// 				"561",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Power Lora Loader (rgthree)",
	// 		"_meta": {
	// 			"title": "Power Lora Loader (rgthree)"
	// 		}
	// 	},
	// 	"585": {
	// 		"inputs": {
	// 			"images": [
	// 				"720",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"588": {
	// 		"inputs": {
	// 			"type": "depth",
	// 			"control_net": [
	// 				"589",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SetUnionControlNetType",
	// 		"_meta": {
	// 			"title": "设置UnionControlNet类型"
	// 		}
	// 	},
	// 	"589": {
	// 		"inputs": {
	// 			"control_net_name": "FLUX.1-dev-ControlNet-Union-Pro-2.0.safetensors"
	// 		},
	// 		"class_type": "ControlNetLoader",
	// 		"_meta": {
	// 			"title": "加载ControlNet模型"
	// 		}
	// 	},
	// 	"590": {
	// 		"inputs": {
	// 			"type": "canny/lineart/anime_lineart/mlsd",
	// 			"control_net": [
	// 				"589",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SetUnionControlNetType",
	// 		"_meta": {
	// 			"title": "设置UnionControlNet类型"
	// 		}
	// 	},
	// 	"595": {
	// 		"inputs": {
	// 			"clip_name": "siglip2_so400m_patch16_512.safetensors"
	// 		},
	// 		"class_type": "AdvancedVisionLoader",
	// 		"_meta": {
	// 			"title": "Load Advanced Vision Model"
	// 		}
	// 	},
	// 	"596": {
	// 		"inputs": {
	// 			"style_model_name": "flex1_redux_siglip2_512.safetensors"
	// 		},
	// 		"class_type": "StyleModelLoader",
	// 		"_meta": {
	// 			"title": "加载风格模型"
	// 		}
	// 	},
	// 	"597": {
	// 		"inputs": {
	// 			"downsampling_factor": [
	// 				"738",
	// 				0
	// 			],
	// 			"downsampling_function": "area",
	// 			"mode": "keep aspect ratio",
	// 			"weight": 1,
	// 			"autocrop_margin": 0.1,
	// 			"conditioning": [
	// 				"539",
	// 				0
	// 			],
	// 			"style_model": [
	// 				"596",
	// 				0
	// 			],
	// 			"clip_vision": [
	// 				"595",
	// 				0
	// 			],
	// 			"image": [
	// 				"735",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ReduxAdvanced",
	// 		"_meta": {
	// 			"title": "ReduxAdvanced"
	// 		}
	// 	},
	// 	"605": {
	// 		"inputs": {
	// 			"image": "2023-0122.jpg"
	// 		},
	// 		"class_type": "LoadImage",
	// 		"_meta": {
	// 			"title": "加载图像"
	// 		}
	// 	},
	// 	"614": {
	// 		"inputs": {
	// 			"image": [
	// 				"550",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "easy imageSize",
	// 		"_meta": {
	// 			"title": "图像尺寸"
	// 		}
	// 	},
	// 	"615": {
	// 		"inputs": {
	// 			"width": [
	// 				"614",
	// 				0
	// 			],
	// 			"height": [
	// 				"614",
	// 				1
	// 			],
	// 			"batch_size": 1
	// 		},
	// 		"class_type": "EmptyLatentImage",
	// 		"_meta": {
	// 			"title": "空Latent图像"
	// 		}
	// 	},
	// 	"628": {
	// 		"inputs": {
	// 			"clip_name": "google--siglip-so400m-patch14-384\\model.safetensors"
	// 		},
	// 		"class_type": "AdvancedVisionLoader",
	// 		"_meta": {
	// 			"title": "Load Advanced Vision Model"
	// 		}
	// 	},
	// 	"629": {
	// 		"inputs": {
	// 			"downsampling_factor": [
	// 				"738",
	// 				0
	// 			],
	// 			"downsampling_function": "area",
	// 			"mode": "keep aspect ratio",
	// 			"weight": 1,
	// 			"autocrop_margin": 0.1,
	// 			"conditioning": [
	// 				"539",
	// 				0
	// 			],
	// 			"style_model": [
	// 				"630",
	// 				0
	// 			],
	// 			"clip_vision": [
	// 				"628",
	// 				0
	// 			],
	// 			"image": [
	// 				"735",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ReduxAdvanced",
	// 		"_meta": {
	// 			"title": "ReduxAdvanced"
	// 		}
	// 	},
	// 	"630": {
	// 		"inputs": {
	// 			"style_model_name": "flux1-redux-dev.safetensors"
	// 		},
	// 		"class_type": "StyleModelLoader",
	// 		"_meta": {
	// 			"title": "加载风格模型"
	// 		}
	// 	},
	// 	"635": {
	// 		"inputs": {
	// 			"Input": 1,
	// 			"latent1": [
	// 				"615",
	// 				0
	// 			],
	// 			"latent2": [
	// 				"548",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "CR Latent Input Switch",
	// 		"_meta": {
	// 			"title": "🔀 CR Latent Input Switch"
	// 		}
	// 	},
	// 	"683": {
	// 		"inputs": {
	// 			"conditioning_to_strength": 0.8,
	// 			"conditioning_to": [
	// 				"687",
	// 				0
	// 			],
	// 			"conditioning_from": [
	// 				"714",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningAverage",
	// 		"_meta": {
	// 			"title": "条件平均"
	// 		}
	// 	},
	// 	"684": {
	// 		"inputs": {
	// 			"conditioning_1": [
	// 				"687",
	// 				0
	// 			],
	// 			"conditioning_2": [
	// 				"714",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningCombine",
	// 		"_meta": {
	// 			"title": "条件合并"
	// 		}
	// 	},
	// 	"685": {
	// 		"inputs": {
	// 			"conditioning_to": [
	// 				"687",
	// 				0
	// 			],
	// 			"conditioning_from": [
	// 				"714",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningConcat",
	// 		"_meta": {
	// 			"title": "条件连接"
	// 		}
	// 	},
	// 	"686": {
	// 		"inputs": {
	// 			"strength": 1.0000000000000004,
	// 			"conditioning": [
	// 				"692",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningSetAreaStrength",
	// 		"_meta": {
	// 			"title": "条件采样区域强度"
	// 		}
	// 	},
	// 	"687": {
	// 		"inputs": {
	// 			"strength": [
	// 				"756",
	// 				1
	// 			],
	// 			"conditioning": [
	// 				"539",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningSetAreaStrength",
	// 		"_meta": {
	// 			"title": "条件采样区域强度"
	// 		}
	// 	},
	// 	"692": {
	// 		"inputs": {
	// 			"select": 1,
	// 			"sel_mode": false,
	// 			"input1": [
	// 				"629",
	// 				0
	// 			],
	// 			"input2": [
	// 				"597",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImpactSwitch",
	// 		"_meta": {
	// 			"title": "Switch (Any)"
	// 		}
	// 	},
	// 	"701": {
	// 		"inputs": {
	// 			"select": 2,
	// 			"sel_mode": false,
	// 			"input1": [
	// 				"684",
	// 				0
	// 			],
	// 			"input2": [
	// 				"685",
	// 				0
	// 			],
	// 			"input3": [
	// 				"683",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImpactSwitch",
	// 		"_meta": {
	// 			"title": "Switch (Any)"
	// 		}
	// 	},
	// 	"703": {
	// 		"inputs": {
	// 			"guidance": 10,
	// 			"conditioning": [
	// 				"701",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "FluxGuidance",
	// 		"_meta": {
	// 			"title": "Flux引导"
	// 		}
	// 	},
	// 	"704": {
	// 		"inputs": {
	// 			"max_shift": 1.15,
	// 			"base_shift": 0.5,
	// 			"width": [
	// 				"706",
	// 				0
	// 			],
	// 			"height": [
	// 				"706",
	// 				1
	// 			],
	// 			"model": [
	// 				"725",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ModelSamplingFlux",
	// 		"_meta": {
	// 			"title": "采样算法（Flux）"
	// 		}
	// 	},
	// 	"706": {
	// 		"inputs": {
	// 			"image": [
	// 				"550",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "GetImageSize+",
	// 		"_meta": {
	// 			"title": "🔧 Get Image Size"
	// 		}
	// 	},
	// 	"714": {
	// 		"inputs": {
	// 			"start": 0.15000000000000002,
	// 			"end": 1,
	// 			"conditioning": [
	// 				"686",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConditioningSetTimestepRange",
	// 		"_meta": {
	// 			"title": "设置条件时间"
	// 		}
	// 	},
	// 	"718": {
	// 		"inputs": {
	// 			"text": "2.7777200000000013",
	// 			"anything": [
	// 				"738",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "easy showAnything",
	// 		"_meta": {
	// 			"title": "展示任何"
	// 		}
	// 	},
	// 	"720": {
	// 		"inputs": {
	// 			"strength": 0.3000000000000001,
	// 			"skin_protection": 0,
	// 			"auto_brightness": false,
	// 			"brightness_range": 1,
	// 			"auto_contrast": true,
	// 			"contrast_range": 0.30000000000000004,
	// 			"auto_saturation": true,
	// 			"saturation_range": 0.30000000000000004,
	// 			"auto_tone": true,
	// 			"tone_strength": 0.5,
	// 			"imitation_image": [
	// 				"735",
	// 				0
	// 			],
	// 			"target_image": [
	// 				"575",
	// 				5
	// 			]
	// 		},
	// 		"class_type": "ImitationHueNode",
	// 		"_meta": {
	// 			"title": "Imitation Hue"
	// 		}
	// 	},
	// 	"725": {
	// 		"inputs": {
	// 			"PowerLoraLoaderHeaderWidget": {
	// 				"type": "PowerLoraLoaderHeaderWidget"
	// 			},
	// 			"lora_1": {
	// 				"on": true,
	// 				"lora": "Vividai_kontext_general_lokr_v2_000004180.safetensors",
	// 				"strength": 0.55
	// 			},
	// 			"➕ Add Lora": "",
	// 			"model": [
	// 				"532",
	// 				0
	// 			],
	// 			"clip": [
	// 				"534",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Power Lora Loader (rgthree)",
	// 		"_meta": {
	// 			"title": "Power Lora Loader (rgthree)"
	// 		}
	// 	},
	// 	"726": {
	// 		"inputs": {
	// 			"text_0": "Enhance the image with added context, such as cars in motion along the roadway, pedestrians walking on sidewalks and paved surfaces, shrubs, trees, and flowers on the grassy areas, and interior spaces furnished and illuminated with lighting effects. Transform the scene into a serene morning atmosphere, render the text and logo with a soft glow, and apply luminous lighting to buildings and roadways, while preserving the original architectural forms, pavement layout, and paving structure without alteration.\nAdd 4 to 6 vehicles on the roadway, place pedestrians on the sidewalks and at the entrance, incorporate shrubs onto the grassy areas, and apply a diffuse reflection effect to the pavement surface.\nA modern architectural building features a façade covered in large-scale tempered glass curtain walls, with a smooth, mirror-like surface that displays high-precision, physically accurate reflections of the surrounding environment: clearly reflecting flowing cloud layers and silhouettes of adjacent buildings, capturing skylight and urban outlines, while simultaneously revealing soft, uniformly warm yellow interior lighting glowing gently through the glass. The surface reflects the city night scene, streaking headlights, and elongated light trails from street lamps. After rain, the glass becomes wet with fine water droplets, creating slightly blurred reflections and dynamic halos that enhance realism. The glass has visible thickness, with authentic light refraction at the edges, producing optical distortions that convey three-dimensional volume. The building exhibits precise proportions, sharp details, and clean structural lines. The surrounding environment includes urban roads, greenery, and pedestrian silhouettes, all rendered with natural and harmonious lighting. The image is in 8K ultra-high resolution, Cinema 4D style, using PBR materials, global illumination, ray-traced reflections and refractions, with crisp depth of field, sharp details, no noise, and professional photographic visual quality., The image depicts a serene and modern setting with a harmonious blend of natural and artificial elements. The overall tone is calm and inviting, characterized by soft, warm hues that evoke a sense of tranquility.\n\nIn terms of color characteristics, the sky is a clear, pale blue, suggesting early morning or late afternoon light. The building's facade features sleek, metallic panels that reflect the surrounding environment, adding depth and dimension to the structure. The glass windows are large and reflective, mirroring the sky and nearby greenery, which enhances the connection between the interior and exterior spaces.\n\nIndoor lighting appears to be subtle yet effective, providing a gentle glow that complements the natural light streaming in through the expansive windows. This creates a balanced ambiance, where the warmth of the daylight is augmented by the softer, more intimate indoor illumination.\n\nOutdoor lighting plays a crucial role in defining the atmosphere. Street lamps cast a soft, diffused light, contributing to the peaceful mood of the scene. The shadows are long and gently elongated, indicating either sunrise or sunset, which adds a touch of warmth and coziness to the environment.\n\nThe atmosphere is one of quiet elegance, with an air of sophistication and modernity. The presence of well-maintained greenery and trees adds a refreshing element, bringing a sense of nature into the urban landscape. The overall effect is one of harmony and balance, where man-made structures coexist seamlessly with the natural world.\n\nArtistically, the composition is clean and minimalist, focusing on simplicity and functionality while maintaining aesthetic appeal. The use of clean lines, smooth surfaces, and reflective materials contributes to a contemporary feel, emphasizing innovation and forward-thinking design principles. The interplay of light and shadow further enhances the visual interest, creating dynamic contrasts that add depth and texture to the scene.",
	// 			"text": [
	// 				"572",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ShowText|pysssss",
	// 		"_meta": {
	// 			"title": "Show Text 🐍"
	// 		}
	// 	},
	// 	"729": {
	// 		"inputs": {
	// 			"seed": 360051921936697
	// 		},
	// 		"class_type": "CR Seed",
	// 		"_meta": {
	// 			"title": "🌱 CR Seed"
	// 		}
	// 	},
	// 	"734": {
	// 		"inputs": {
	// 			"axis": "x",
	// 			"image": [
	// 				"761",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageFlip+",
	// 		"_meta": {
	// 			"title": "🔧 Image Flip"
	// 		}
	// 	},
	// 	"735": {
	// 		"inputs": {
	// 			"boolean": false,
	// 			"on_true": [
	// 				"761",
	// 				0
	// 			],
	// 			"on_false": [
	// 				"734",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Switch any [Crystools]",
	// 		"_meta": {
	// 			"title": "🪛 Switch any"
	// 		}
	// 	},
	// 	"738": {
	// 		"inputs": {
	// 			"value": 0.22221500000000008,
	// 			"min": 1.0000000000000002,
	// 			"max": 9.000000000000002,
	// 			"rounding": 0
	// 		},
	// 		"class_type": "SimpleMathSlider+",
	// 		"_meta": {
	// 			"title": "🔧 Simple Math Slider"
	// 		}
	// 	},
	// 	"756": {
	// 		"inputs": {
	// 			"value": "a-b",
	// 			"a": [
	// 				"757",
	// 				0
	// 			],
	// 			"b": [
	// 				"738",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SimpleMath+",
	// 		"_meta": {
	// 			"title": "🔧 Simple Math"
	// 		}
	// 	},
	// 	"757": {
	// 		"inputs": {
	// 			"value": 12.000000000000005
	// 		},
	// 		"class_type": "FloatConstant",
	// 		"_meta": {
	// 			"title": "Float Constant"
	// 		}
	// 	},
	// 	"758": {
	// 		"inputs": {
	// 			"text": "9.222279999999998",
	// 			"anything": [
	// 				"756",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "easy showAnything",
	// 		"_meta": {
	// 			"title": "展示任何"
	// 		}
	// 	},
	// 	"760": {
	// 		"inputs": {
	// 			"model": "glm-4v-flash",
	// 			"user_prompt": "Describe in detail only the tones, color characteristics, indoor and outdoor lighting, atmosphere, and artistic effects depicted in the image—do not mention any architectural or road shapes, materials, forms, text, or logos. Your description should enable someone to vividly imagine the atmosphere of the scene simply by listening, as if they were seeing the image. Provide the response in English.",
	// 			"image": [
	// 				"735",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LayerUtility: ZhipuGLM4V",
	// 		"_meta": {
	// 			"title": "图层工具：ZhipuGLM4V（高级）"
	// 		}
	// 	},
	// 	"761": {
	// 		"inputs": {
	// 			"upscale_method": "lanczos",
	// 			"megapixels": 2.000000000000001,
	// 			"image": [
	// 				"766",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageScaleToTotalPixels",
	// 		"_meta": {
	// 			"title": "缩放图像（像素）"
	// 		}
	// 	},
	// 	"762": {
	// 		"inputs": {
	// 			"positive": ""
	// 		},
	// 		"class_type": "easy positive",
	// 		"_meta": {
	// 			"title": "正面提示词-tsc"
	// 		}
	// 	},
	// 	"764": {
	// 		"inputs": {
	// 			"mode": "incremental_image",
	// 			"seed": 521060189789199,
	// 			"index": 0,
	// 			"label": "*",
	// 			"path": "C:\\Users\\Administrator\\Desktop\\参考图\\77",
	// 			"pattern": "*",
	// 			"allow_RGBA_output": "false",
	// 			"filename_text_extension": "true"
	// 		},
	// 		"class_type": "Load Image Batch",
	// 		"_meta": {
	// 			"title": "Load Image Batch"
	// 		}
	// 	},
	// 	"766": {
	// 		"inputs": {
	// 			"select": 1,
	// 			"sel_mode": false,
	// 			"input1": [
	// 				"605",
	// 				0
	// 			],
	// 			"input2": [
	// 				"764",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImpactSwitch",
	// 		"_meta": {
	// 			"title": "Switch (Any)"
	// 		}
	// 	},
	// 	"884": {
	// 		"inputs": {
	// 			"purge_cache": true,
	// 			"purge_models": true,
	// 			"anything": [
	// 				"720",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PurgeVRAM",
	// 		"_meta": {
	// 			"title": "PurgeVRAM"
	// 		}
	// 	},
	// 	"977": {
	// 		"inputs": {
	// 			"output_path": "第一阶段",
	// 			"filename_prefix": "Preview image",
	// 			"filename_delimiter": "_",
	// 			"filename_number_padding": 4,
	// 			"filename_number_start": "false",
	// 			"extension": "jpg",
	// 			"dpi": 72,
	// 			"quality": 100,
	// 			"optimize_image": "false",
	// 			"lossless_webp": "false",
	// 			"overwrite_mode": "false",
	// 			"show_history": "false",
	// 			"show_history_by_prefix": "false",
	// 			"embed_workflow": "false",
	// 			"show_previews": "false"
	// 		},
	// 		"class_type": "Image Save",
	// 		"_meta": {
	// 			"title": "Image Save"
	// 		}
	// 	},
	// 	"1070": {
	// 		"inputs": {
	// 			"mode": "incremental_image",
	// 			"seed": 521060189789198,
	// 			"index": 0,
	// 			"label": "*",
	// 			"path": "C:\\Users\\Administrator\\Desktop\\选图\\5",
	// 			"pattern": "*",
	// 			"allow_RGBA_output": "false",
	// 			"filename_text_extension": "true"
	// 		},
	// 		"class_type": "Load Image Batch",
	// 		"_meta": {
	// 			"title": "Load Image Batch"
	// 		}
	// 	},
	// 	"1071": {
	// 		"inputs": {
	// 			"select": 1,
	// 			"sel_mode": false,
	// 			"input1": [
	// 				"536",
	// 				0
	// 			],
	// 			"input2": [
	// 				"1070",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImpactSwitch",
	// 		"_meta": {
	// 			"title": "Switch (Any)"
	// 		}
	// 	},
	// 	"1072": {
	// 		"inputs": {
	// 			"rgthree_comparer": {
	// 				"images": [
	// 					{
	// 						"name": "B",
	// 						"selected": true,
	// 						"url": "/api/view?filename=rgthree.compare._temp_oapvt_00007_.png&type=temp&subfolder=&rand=0.04846534498875754"
	// 					}
	// 				]
	// 			},
	// 			"image_b": [
	// 				"551",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Image Comparer (rgthree)",
	// 		"_meta": {
	// 			"title": "Image Comparer (rgthree)"
	// 		}
	// 	},
	// 	"1085": {
	// 		"inputs": {
	// 			"filename_prefix": "ComfyUI",
	// 			"images": [
	// 				"720",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SaveImage",
	// 		"_meta": {
	// 			"title": "保存图像"
	// 		}
	// 	}
	// },

	// 建筑一
	"prompt": {},

	// 建筑二
	// "prompt": {
	// 	"2": {
	// 		"inputs": {
	// 			"scale_factor": 1.5000000000000002,
	// 			"blur_strength": 2,
	// 			"radius": 7,
	// 			"eps": 0.01,
	// 			"resolution": 512,
	// 			"image": [
	// 				"259",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "TTPlanet_TileGF_Preprocessor",
	// 		"_meta": {
	// 			"title": "TTPlanet Tile GuidedFilter"
	// 		}
	// 	},
	// 	"3": {
	// 		"inputs": {
	// 			"control_net_name": "xinsir-tile-sdxl-1.0.safetensors"
	// 		},
	// 		"class_type": "ControlNetLoaderAdvanced",
	// 		"_meta": {
	// 			"title": "Load Advanced ControlNet Model 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"16": {
	// 		"inputs": {
	// 			"target_side_length": [
	// 				"33",
	// 				0
	// 			],
	// 			"image": [
	// 				"32",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResizeToPixelCount",
	// 		"_meta": {
	// 			"title": "📐 按边长调整图像大小"
	// 		}
	// 	},
	// 	"17": {
	// 		"inputs": {
	// 			"upscale_model": [
	// 				"22",
	// 				0
	// 			],
	// 			"image": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageUpscaleWithModel",
	// 		"_meta": {
	// 			"title": "使用模型放大图像"
	// 		}
	// 	},
	// 	"18": {
	// 		"inputs": {
	// 			"steps": [
	// 				"23",
	// 				0
	// 			],
	// 			"end_at_step": [
	// 				"271",
	// 				0
	// 			],
	// 			"cfg": 1,
	// 			"sampler_name": "dpmpp_2m",
	// 			"scheduler": "karras",
	// 			"normalize": "disable",
	// 			"model": [
	// 				"139",
	// 				0
	// 			],
	// 			"positive": [
	// 				"286",
	// 				0
	// 			],
	// 			"negative": [
	// 				"287",
	// 				0
	// 			],
	// 			"latent_image": [
	// 				"64",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "BNK_Unsampler",
	// 		"_meta": {
	// 			"title": "Unsampler"
	// 		}
	// 	},
	// 	"20": {
	// 		"inputs": {
	// 			"image": [
	// 				"179",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Get Image Size",
	// 		"_meta": {
	// 			"title": "Get Image Size"
	// 		}
	// 	},
	// 	"22": {
	// 		"inputs": {
	// 			"model_name": "2xNomosUni_span_multijpg_ldl.pth"
	// 		},
	// 		"class_type": "UpscaleModelLoader",
	// 		"_meta": {
	// 			"title": "加载放大模型"
	// 		}
	// 	},
	// 	"23": {
	// 		"inputs": {
	// 			"Number": "30"
	// 		},
	// 		"class_type": "Int",
	// 		"_meta": {
	// 			"title": "Int"
	// 		}
	// 	},
	// 	"32": {
	// 		"inputs": {
	// 			"upscale_model": [
	// 				"22",
	// 				0
	// 			],
	// 			"image": [
	// 				"267",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageUpscaleWithModel",
	// 		"_meta": {
	// 			"title": "使用模型放大图像"
	// 		}
	// 	},
	// 	"33": {
	// 		"inputs": {
	// 			"Number": "3200"
	// 		},
	// 		"class_type": "Int",
	// 		"_meta": {
	// 			"title": "Int"
	// 		}
	// 	},
	// 	"34": {
	// 		"inputs": {
	// 			"width": [
	// 				"245",
	// 				0
	// 			],
	// 			"height": [
	// 				"245",
	// 				1
	// 			],
	// 			"interpolation": "nearest",
	// 			"method": "stretch",
	// 			"condition": "always",
	// 			"multiple_of": 0,
	// 			"image": [
	// 				"17",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResize+",
	// 		"_meta": {
	// 			"title": "🔧 Image Resize"
	// 		}
	// 	},
	// 	"35": {
	// 		"inputs": {
	// 			"image": "$35-0",
	// 			"block": false,
	// 			"restore_mask": "never",
	// 			"images": [
	// 				"16",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewBridge",
	// 		"_meta": {
	// 			"title": "Preview Bridge (Image)"
	// 		}
	// 	},
	// 	"36": {
	// 		"inputs": {
	// 			"rgthree_comparer": {
	// 				"images": [
	// 					{
	// 						"name": "A",
	// 						"selected": true,
	// 						"url": "/api/view?filename=rgthree.compare._temp_xrhlo_00001_.png&type=temp&subfolder=&rand=0.19199013421837896"
	// 					},
	// 					{
	// 						"name": "B",
	// 						"selected": true,
	// 						"url": "/api/view?filename=rgthree.compare._temp_xrhlo_00002_.png&type=temp&subfolder=&rand=0.08484520162891718"
	// 					}
	// 				]
	// 			},
	// 			"image_a": [
	// 				"16",
	// 				0
	// 			],
	// 			"image_b": [
	// 				"259",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Image Comparer (rgthree)",
	// 		"_meta": {
	// 			"title": "Image Comparer (rgthree)"
	// 		}
	// 	},
	// 	"52": {
	// 		"inputs": {
	// 			"scale": 1.5,
	// 			"adaptive_scale": 0,
	// 			"unet_block": "middle",
	// 			"unet_block_id": 0,
	// 			"sigma_start": -1,
	// 			"sigma_end": -1,
	// 			"rescale": 0,
	// 			"rescale_mode": "full",
	// 			"unet_block_list": "",
	// 			"model": [
	// 				"201",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PerturbedAttention",
	// 		"_meta": {
	// 			"title": "Perturbed-Attention Guidance (Advanced)"
	// 		}
	// 	},
	// 	"61": {
	// 		"inputs": {
	// 			"width": [
	// 				"20",
	// 				0
	// 			],
	// 			"height": [
	// 				"20",
	// 				1
	// 			],
	// 			"interpolation": "bilinear",
	// 			"method": "stretch",
	// 			"condition": "always",
	// 			"multiple_of": 0,
	// 			"image": [
	// 				"98",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResize+",
	// 		"_meta": {
	// 			"title": "🔧 Image Resize"
	// 		}
	// 	},
	// 	"63": {
	// 		"inputs": {
	// 			"model_name": "2xNomosUni_span_multijpg_ldl.pth"
	// 		},
	// 		"class_type": "UpscaleModelLoader",
	// 		"_meta": {
	// 			"title": "加载放大模型"
	// 		}
	// 	},
	// 	"64": {
	// 		"inputs": {
	// 			"pixels": [
	// 				"65",
	// 				0
	// 			],
	// 			"vae": [
	// 				"227",
	// 				2
	// 			]
	// 		},
	// 		"class_type": "VAEEncode",
	// 		"_meta": {
	// 			"title": "VAE编码"
	// 		}
	// 	},
	// 	"65": {
	// 		"inputs": {
	// 			"image": "$65-0",
	// 			"block": false,
	// 			"restore_mask": "never",
	// 			"images": [
	// 				"61",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewBridge",
	// 		"_meta": {
	// 			"title": "Preview Bridge (Image)"
	// 		}
	// 	},
	// 	"97": {
	// 		"inputs": {
	// 			"image": "$97-0",
	// 			"block": false,
	// 			"restore_mask": "never",
	// 			"images": [
	// 				"193",
	// 				5
	// 			]
	// 		},
	// 		"class_type": "PreviewBridge",
	// 		"_meta": {
	// 			"title": "Preview Bridge (Image)"
	// 		}
	// 	},
	// 	"98": {
	// 		"inputs": {
	// 			"upscale_model": [
	// 				"63",
	// 				0
	// 			],
	// 			"image": [
	// 				"262",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageUpscaleWithModel",
	// 		"_meta": {
	// 			"title": "使用模型放大图像"
	// 		}
	// 	},
	// 	"138": {
	// 		"inputs": {
	// 			"image": "c09-ai-Camera009 拷贝.jpg"
	// 		},
	// 		"class_type": "LoadImage",
	// 		"_meta": {
	// 			"title": "加载图像"
	// 		}
	// 	},
	// 	"139": {
	// 		"inputs": {
	// 			"ckpt_name": "sd_xl_base_1.0_fixvae_fp16.safetensors"
	// 		},
	// 		"class_type": "CheckpointLoaderSimple",
	// 		"_meta": {
	// 			"title": "Checkpoint加载器（简易）"
	// 		}
	// 	},
	// 	"143": {
	// 		"inputs": {
	// 			"value": "a*b",
	// 			"a": [
	// 				"177",
	// 				0
	// 			],
	// 			"b": [
	// 				"181",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SimpleMath+",
	// 		"_meta": {
	// 			"title": "🔧 Simple Math"
	// 		}
	// 	},
	// 	"144": {
	// 		"inputs": {
	// 			"value": "a*b",
	// 			"a": [
	// 				"177",
	// 				1
	// 			],
	// 			"b": [
	// 				"181",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SimpleMath+",
	// 		"_meta": {
	// 			"title": "🔧 Simple Math"
	// 		}
	// 	},
	// 	"145": {
	// 		"inputs": {
	// 			"action": "append",
	// 			"tidy_tags": "yes",
	// 			"text_a": [
	// 				"782",
	// 				0
	// 			],
	// 			"text_b": [
	// 				"208",
	// 				0
	// 			],
	// 			"text_c": ""
	// 		},
	// 		"class_type": "StringFunction|pysssss",
	// 		"_meta": {
	// 			"title": "String Function 🐍"
	// 		}
	// 	},
	// 	"149": {
	// 		"inputs": {
	// 			"target_side_length": [
	// 				"153",
	// 				0
	// 			],
	// 			"image": [
	// 				"138",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResizeToPixelCount",
	// 		"_meta": {
	// 			"title": "📐 按边长调整图像大小"
	// 		}
	// 	},
	// 	"150": {
	// 		"inputs": {
	// 			"any_02": [
	// 				"167",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Any Switch (rgthree)",
	// 		"_meta": {
	// 			"title": "Any Switch (rgthree)"
	// 		}
	// 	},
	// 	"151": {
	// 		"inputs": {
	// 			"any_02": [
	// 				"166",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Any Switch (rgthree)",
	// 		"_meta": {
	// 			"title": "Any Switch (rgthree)"
	// 		}
	// 	},
	// 	"153": {
	// 		"inputs": {
	// 			"Number": "768"
	// 		},
	// 		"class_type": "Int",
	// 		"_meta": {
	// 			"title": "Int"
	// 		}
	// 	},
	// 	"166": {
	// 		"inputs": {
	// 			"Number": "0.22"
	// 		},
	// 		"class_type": "Float",
	// 		"_meta": {
	// 			"title": "Float"
	// 		}
	// 	},
	// 	"167": {
	// 		"inputs": {
	// 			"pixels": [
	// 				"149",
	// 				0
	// 			],
	// 			"vae": [
	// 				"227",
	// 				2
	// 			]
	// 		},
	// 		"class_type": "VAEEncode",
	// 		"_meta": {
	// 			"title": "VAE编码"
	// 		}
	// 	},
	// 	"176": {
	// 		"inputs": {
	// 			"value": "a*b",
	// 			"a": [
	// 				"177",
	// 				1
	// 			],
	// 			"b": [
	// 				"181",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SimpleMath+",
	// 		"_meta": {
	// 			"title": "🔧 Simple Math"
	// 		}
	// 	},
	// 	"177": {
	// 		"inputs": {
	// 			"image": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageGenResolutionFromImage",
	// 		"_meta": {
	// 			"title": "Generation Resolution From Image"
	// 		}
	// 	},
	// 	"179": {
	// 		"inputs": {
	// 			"target_side_length": [
	// 				"257",
	// 				0
	// 			],
	// 			"image": [
	// 				"98",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResizeToPixelCount",
	// 		"_meta": {
	// 			"title": "📐 按边长调整图像大小"
	// 		}
	// 	},
	// 	"180": {
	// 		"inputs": {
	// 			"value": "a*b",
	// 			"a": [
	// 				"177",
	// 				0
	// 			],
	// 			"b": [
	// 				"181",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SimpleMath+",
	// 		"_meta": {
	// 			"title": "🔧 Simple Math"
	// 		}
	// 	},
	// 	"181": {
	// 		"inputs": {
	// 			"value": 4
	// 		},
	// 		"class_type": "ImpactInt",
	// 		"_meta": {
	// 			"title": "ImpactInt"
	// 		}
	// 	},
	// 	"182": {
	// 		"inputs": {
	// 			"width": [
	// 				"143",
	// 				0
	// 			],
	// 			"height": [
	// 				"144",
	// 				0
	// 			],
	// 			"crop_w": 0,
	// 			"crop_h": 0,
	// 			"target_width": [
	// 				"143",
	// 				0
	// 			],
	// 			"target_height": [
	// 				"144",
	// 				0
	// 			],
	// 			"text_g": [
	// 				"207",
	// 				0
	// 			],
	// 			"text_l": [
	// 				"207",
	// 				0
	// 			],
	// 			"clip": [
	// 				"247",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "CLIPTextEncodeSDXL",
	// 		"_meta": {
	// 			"title": "CLIP文本编码SDXL"
	// 		}
	// 	},
	// 	"183": {
	// 		"inputs": {
	// 			"stop_at_clip_layer": -2,
	// 			"clip": [
	// 				"227",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "CLIPSetLastLayer",
	// 		"_meta": {
	// 			"title": "设置CLIP最后一层"
	// 		}
	// 	},
	// 	"186": {
	// 		"inputs": {
	// 			"image": "2023-0122.jpg"
	// 		},
	// 		"class_type": "Load Image",
	// 		"_meta": {
	// 			"title": "Load Image (Soze)"
	// 		}
	// 	},
	// 	"187": {
	// 		"inputs": {
	// 			"axis": "x",
	// 			"image": [
	// 				"186",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageFlip+",
	// 		"_meta": {
	// 			"title": "🔧 Image Flip"
	// 		}
	// 	},
	// 	"190": {
	// 		"inputs": {
	// 			"images": [
	// 				"774",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"191": {
	// 		"inputs": {
	// 			"width": [
	// 				"219",
	// 				0
	// 			],
	// 			"height": [
	// 				"219",
	// 				1
	// 			],
	// 			"interpolation": "nearest",
	// 			"method": "stretch",
	// 			"condition": "always",
	// 			"multiple_of": 0,
	// 			"image": [
	// 				"774",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageResize+",
	// 		"_meta": {
	// 			"title": "🔧 Image Resize"
	// 		}
	// 	},
	// 	"193": {
	// 		"inputs": {
	// 			"seed": 755698385400488,
	// 			"steps": 25,
	// 			"cfg": 18,
	// 			"sampler_name": "euler_ancestral",
	// 			"scheduler": "sgm_uniform",
	// 			"denoise": [
	// 				"151",
	// 				0
	// 			],
	// 			"preview_method": "none",
	// 			"vae_decode": "true",
	// 			"model": [
	// 				"713",
	// 				0
	// 			],
	// 			"positive": [
	// 				"690",
	// 				0
	// 			],
	// 			"negative": [
	// 				"690",
	// 				1
	// 			],
	// 			"latent_image": [
	// 				"150",
	// 				0
	// 			],
	// 			"optional_vae": [
	// 				"227",
	// 				2
	// 			]
	// 		},
	// 		"class_type": "KSampler (Efficient)",
	// 		"_meta": {
	// 			"title": "KSampler (Efficient)"
	// 		}
	// 	},
	// 	"201": {
	// 		"inputs": {
	// 			"tonemap_multiplier": 0.05,
	// 			"rescale_multiplier": 1,
	// 			"model": [
	// 				"247",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "TonemapNoiseWithRescaleCFG",
	// 		"_meta": {
	// 			"title": "TonemapNoiseWithRescaleCFG"
	// 		}
	// 	},
	// 	"204": {
	// 		"inputs": {
	// 			"add_noise": "disable",
	// 			"noise_seed": 591475053321953,
	// 			"steps": [
	// 				"23",
	// 				0
	// 			],
	// 			"cfg": 1.5,
	// 			"sampler_name": "dpmpp_2m",
	// 			"scheduler": "karras",
	// 			"start_at_step": [
	// 				"271",
	// 				0
	// 			],
	// 			"end_at_step": 10000,
	// 			"return_with_leftover_noise": "disable",
	// 			"preview_method": "auto",
	// 			"vae_decode": "true (tiled)",
	// 			"model": [
	// 				"247",
	// 				0
	// 			],
	// 			"positive": [
	// 				"252",
	// 				0
	// 			],
	// 			"negative": [
	// 				"252",
	// 				0
	// 			],
	// 			"latent_image": [
	// 				"18",
	// 				0
	// 			],
	// 			"optional_vae": [
	// 				"227",
	// 				2
	// 			]
	// 		},
	// 		"class_type": "KSampler Adv. (Efficient)",
	// 		"_meta": {
	// 			"title": "KSampler Adv. (Efficient)"
	// 		}
	// 	},
	// 	"205": {
	// 		"inputs": {
	// 			"images": [
	// 				"204",
	// 				5
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"207": {
	// 		"inputs": {
	// 			"negative": "distorted edges,"
	// 		},
	// 		"class_type": "easy negative",
	// 		"_meta": {
	// 			"title": "负面提示词"
	// 		}
	// 	},
	// 	"208": {
	// 		"inputs": {
	// 			"positive": "Masterpiece, Best Quality, Ultra Fine, Ultra Realistic, (Realism: 1.2), 16K, High Detail, High Resolution, (Extremely Fine: 1.2), Crazy Detail, Sharp Focus, Realistic Accuracy, Photography, Creative Composition, Epic, Gorgeous, (Cinematic Grain:1.2),  Venue Landscape, Real Photo,intricate textures,(cinematic lighting:1.4),Unreal Engine 5,"
	// 		},
	// 		"class_type": "easy positive",
	// 		"_meta": {
	// 			"title": "正面提示词"
	// 		}
	// 	},
	// 	"210": {
	// 		"inputs": {
	// 			"width": [
	// 				"180",
	// 				0
	// 			],
	// 			"height": [
	// 				"176",
	// 				0
	// 			],
	// 			"crop_w": 0,
	// 			"crop_h": 0,
	// 			"target_width": [
	// 				"180",
	// 				0
	// 			],
	// 			"target_height": [
	// 				"176",
	// 				0
	// 			],
	// 			"text_g": [
	// 				"145",
	// 				0
	// 			],
	// 			"text_l": [
	// 				"145",
	// 				0
	// 			],
	// 			"clip": [
	// 				"247",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "CLIPTextEncodeSDXL",
	// 		"_meta": {
	// 			"title": "CLIP文本编码SDXL"
	// 		}
	// 	},
	// 	"219": {
	// 		"inputs": {
	// 			"image": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Get Image Size",
	// 		"_meta": {
	// 			"title": "Get Image Size"
	// 		}
	// 	},
	// 	"227": {
	// 		"inputs": {
	// 			"ckpt_name": "(Billus)CKPT_0.4C_Pro.safetensors"
	// 		},
	// 		"class_type": "CheckpointLoaderSimple",
	// 		"_meta": {
	// 			"title": "Checkpoint加载器（简易）"
	// 		}
	// 	},
	// 	"229": {
	// 		"inputs": {
	// 			"start_percent": 0,
	// 			"end_percent": 0.8500000000000002,
	// 			"strength_start": 0.3500000000000001,
	// 			"strength_end": 0.10000000000000002,
	// 			"interpolation": "linear",
	// 			"intervals": 50,
	// 			"null_latent_kf_strength": 0,
	// 			"inherit_missing": true,
	// 			"print_keyframes": false
	// 		},
	// 		"class_type": "ACN_TimestepKeyframeInterpolation",
	// 		"_meta": {
	// 			"title": "Timestep Keyframe Interp. 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"245": {
	// 		"inputs": {
	// 			"image": [
	// 				"16",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Get Image Size",
	// 		"_meta": {
	// 			"title": "Get Image Size"
	// 		}
	// 	},
	// 	"247": {
	// 		"inputs": {
	// 			"PowerLoraLoaderHeaderWidget": {
	// 				"type": "PowerLoraLoaderHeaderWidget"
	// 			},
	// 			"lora_1": {
	// 				"on": true,
	// 				"lora": "hm-general-000009.safetensors",
	// 				"strength": 0.4
	// 			},
	// 			"➕ Add Lora": "",
	// 			"model": [
	// 				"227",
	// 				0
	// 			],
	// 			"clip": [
	// 				"183",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Power Lora Loader (rgthree)",
	// 		"_meta": {
	// 			"title": "Power Lora Loader (rgthree)"
	// 		}
	// 	},
	// 	"250": {
	// 		"inputs": {
	// 			"base_multiplier": 1,
	// 			"flip_weights": false,
	// 			"uncond_multiplier": 0.010000000000000002
	// 		},
	// 		"class_type": "ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"252": {
	// 		"inputs": {
	// 			"strength": 0.8500000000000002,
	// 			"start_percent": 0,
	// 			"end_percent": 0.9000000000000002,
	// 			"positive": [
	// 				"676",
	// 				0
	// 			],
	// 			"negative": [
	// 				"676",
	// 				1
	// 			],
	// 			"control_net": [
	// 				"3",
	// 				0
	// 			],
	// 			"image": [
	// 				"2",
	// 				0
	// 			],
	// 			"timestep_kf": [
	// 				"229",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"250",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"254": {
	// 		"inputs": {
	// 			"seed": 975079131352467
	// 		},
	// 		"class_type": "Seed Everywhere",
	// 		"_meta": {
	// 			"title": "Seed Everywhere"
	// 		}
	// 	},
	// 	"257": {
	// 		"inputs": {
	// 			"Number": "1024"
	// 		},
	// 		"class_type": "Int",
	// 		"_meta": {
	// 			"title": "Int"
	// 		}
	// 	},
	// 	"259": {
	// 		"inputs": {
	// 			"method": "wavelet",
	// 			"image_output": "Preview",
	// 			"save_prefix": "ComfyUI",
	// 			"image_ref": [
	// 				"35",
	// 				0
	// 			],
	// 			"image_target": [
	// 				"34",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "easy imageColorMatch",
	// 		"_meta": {
	// 			"title": "图像颜色匹配"
	// 		}
	// 	},
	// 	"261": {
	// 		"inputs": {
	// 			"sam_model": "sam_vit_b (375MB)",
	// 			"grounding_dino_model": "GroundingDINO_SwinT_OGC (694MB)",
	// 			"threshold": 0.3,
	// 			"detail_method": "VITMatte",
	// 			"detail_erode": 6,
	// 			"detail_dilate": 6,
	// 			"black_point": 0.15,
	// 			"white_point": 0.99,
	// 			"process_detail": true,
	// 			"prompt": "Building，Structure，Wall,",
	// 			"device": "cuda",
	// 			"max_megapixels": 2,
	// 			"cache_model": false,
	// 			"image": [
	// 				"265",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LayerMask: SegmentAnythingUltra V2",
	// 		"_meta": {
	// 			"title": "图层遮罩：SegmentAnything Ultra V2（高级）"
	// 		}
	// 	},
	// 	"262": {
	// 		"inputs": {
	// 			"mode": "soft_light",
	// 			"blur_sigma": 1,
	// 			"blend_factor": 0.5,
	// 			"image_output": "Preview",
	// 			"save_prefix": "ComfyUI",
	// 			"target": [
	// 				"267",
	// 				0
	// 			],
	// 			"source": [
	// 				"274",
	// 				0
	// 			],
	// 			"mask": [
	// 				"261",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "easy imageDetailTransfer",
	// 		"_meta": {
	// 			"title": "图像细节迁移"
	// 		}
	// 	},
	// 	"265": {
	// 		"inputs": {
	// 			"width": 2048,
	// 			"height": 2048,
	// 			"upscale_method": "lanczos",
	// 			"keep_proportion": true,
	// 			"divisible_by": 2,
	// 			"crop": "disabled",
	// 			"image": [
	// 				"149",
	// 				0
	// 			],
	// 			"width_input": [
	// 				"266",
	// 				0
	// 			],
	// 			"height_input": [
	// 				"266",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "ImageResizeKJ",
	// 		"_meta": {
	// 			"title": "Resize Image (deprecated)"
	// 		}
	// 	},
	// 	"266": {
	// 		"inputs": {
	// 			"image": [
	// 				"267",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "easy imageSize",
	// 		"_meta": {
	// 			"title": "图像尺寸"
	// 		}
	// 	},
	// 	"267": {
	// 		"inputs": {
	// 			"strength": 0.30000000000000004,
	// 			"skin_protection": 0,
	// 			"auto_brightness": false,
	// 			"brightness_range": 1,
	// 			"auto_contrast": true,
	// 			"contrast_range": 0.30000000000000004,
	// 			"auto_saturation": true,
	// 			"saturation_range": 0.30000000000000004,
	// 			"auto_tone": true,
	// 			"tone_strength": 0.5,
	// 			"imitation_image": [
	// 				"191",
	// 				0
	// 			],
	// 			"target_image": [
	// 				"97",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImitationHueNode",
	// 		"_meta": {
	// 			"title": "Imitation Hue"
	// 		}
	// 	},
	// 	"268": {
	// 		"inputs": {
	// 			"images": [
	// 				"267",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"271": {
	// 		"inputs": {
	// 			"Number": "9"
	// 		},
	// 		"class_type": "Int",
	// 		"_meta": {
	// 			"title": "Int"
	// 		}
	// 	},
	// 	"274": {
	// 		"inputs": {
	// 			"blend_factor": 0.7000000000000002,
	// 			"blend_mode": "soft_light",
	// 			"image1": [
	// 				"265",
	// 				0
	// 			],
	// 			"image2": [
	// 				"267",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ImageBlend",
	// 		"_meta": {
	// 			"title": "混合图像"
	// 		}
	// 	},
	// 	"275": {
	// 		"inputs": {
	// 			"images": [
	// 				"274",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"286": {
	// 		"inputs": {
	// 			"text": [
	// 				"145",
	// 				0
	// 			],
	// 			"clip": [
	// 				"247",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "CLIPTextEncode",
	// 		"_meta": {
	// 			"title": "CLIP文本编码"
	// 		}
	// 	},
	// 	"287": {
	// 		"inputs": {
	// 			"text": [
	// 				"207",
	// 				0
	// 			],
	// 			"clip": [
	// 				"247",
	// 				1
	// 			]
	// 		},
	// 		"class_type": "CLIPTextEncode",
	// 		"_meta": {
	// 			"title": "CLIP文本编码"
	// 		}
	// 	},
	// 	"658": {
	// 		"inputs": {
	// 			"images": [
	// 				"780",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"659": {
	// 		"inputs": {
	// 			"base_multiplier": 0.8250000000000002,
	// 			"uncond_multiplier": 0.5000000000000001
	// 		},
	// 		"class_type": "ACN_ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"660": {
	// 		"inputs": {
	// 			"strength": 0.5000000000000001,
	// 			"start_percent": 0,
	// 			"end_percent": 0.5,
	// 			"positive": [
	// 				"210",
	// 				0
	// 			],
	// 			"negative": [
	// 				"182",
	// 				0
	// 			],
	// 			"control_net": [
	// 				"665",
	// 				0
	// 			],
	// 			"image": [
	// 				"780",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"659",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"661": {
	// 		"inputs": {
	// 			"strength": 0.8500000000000002,
	// 			"start_percent": 0.30000000000000004,
	// 			"end_percent": 0.8500000000000002,
	// 			"positive": [
	// 				"660",
	// 				0
	// 			],
	// 			"negative": [
	// 				"660",
	// 				1
	// 			],
	// 			"control_net": [
	// 				"665",
	// 				0
	// 			],
	// 			"image": [
	// 				"778",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"664",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"662": {
	// 		"inputs": {
	// 			"images": [
	// 				"778",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"664": {
	// 		"inputs": {
	// 			"base_multiplier": 0.8250000000000001,
	// 			"uncond_multiplier": 0.5000000000000001
	// 		},
	// 		"class_type": "ACN_ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"665": {
	// 		"inputs": {
	// 			"control_net_name": "mistoLine_rank256.safetensors"
	// 		},
	// 		"class_type": "ControlNetLoader",
	// 		"_meta": {
	// 			"title": "加载ControlNet模型"
	// 		}
	// 	},
	// 	"666": {
	// 		"inputs": {
	// 			"base_multiplier": 0.8250000000000001,
	// 			"uncond_multiplier": 0.5
	// 		},
	// 		"class_type": "ACN_ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"667": {
	// 		"inputs": {
	// 			"base_multiplier": 0.8250000000000002,
	// 			"uncond_multiplier": 0.010000000000000002
	// 		},
	// 		"class_type": "ACN_ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"668": {
	// 		"inputs": {
	// 			"base_multiplier": 0.8250000000000001,
	// 			"uncond_multiplier": 0
	// 		},
	// 		"class_type": "ACN_ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"669": {
	// 		"inputs": {
	// 			"base_multiplier": 0.8000000000000002,
	// 			"uncond_multiplier": 0.010000000000000002
	// 		},
	// 		"class_type": "ACN_ScaledSoftControlNetWeights",
	// 		"_meta": {
	// 			"title": "Scaled Soft Weights 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"670": {
	// 		"inputs": {
	// 			"preprocessor": "DepthAnythingV2Preprocessor",
	// 			"resolution": 2880,
	// 			"image": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "AIO_Preprocessor",
	// 		"_meta": {
	// 			"title": "AIO Aux Preprocessor"
	// 		}
	// 	},
	// 	"671": {
	// 		"inputs": {
	// 			"type": "depth",
	// 			"control_net": [
	// 				"672",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "SetUnionControlNetType",
	// 		"_meta": {
	// 			"title": "设置UnionControlNet类型"
	// 		}
	// 	},
	// 	"672": {
	// 		"inputs": {
	// 			"control_net_name": "xinsir-controlnet-union-sdxl-1.0_promax.safetensors",
	// 			"model": [
	// 				"52",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "DiffControlNetLoader",
	// 		"_meta": {
	// 			"title": "加载ControlNet模型（diff）"
	// 		}
	// 	},
	// 	"674": {
	// 		"inputs": {
	// 			"max_width": 2880,
	// 			"max_height": 2880,
	// 			"min_width": 768,
	// 			"min_height": 768,
	// 			"crop_if_required": "no",
	// 			"images": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ConstrainImage|pysssss",
	// 		"_meta": {
	// 			"title": "Constrain Image 🐍"
	// 		}
	// 	},
	// 	"675": {
	// 		"inputs": {
	// 			"strength": 0.8500000000000002,
	// 			"start_percent": 0,
	// 			"end_percent": 0.5,
	// 			"positive": [
	// 				"210",
	// 				0
	// 			],
	// 			"negative": [
	// 				"182",
	// 				0
	// 			],
	// 			"control_net": [
	// 				"665",
	// 				0
	// 			],
	// 			"image": [
	// 				"780",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"667",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"676": {
	// 		"inputs": {
	// 			"strength": 0.7500000000000001,
	// 			"start_percent": 0,
	// 			"end_percent": 0.65,
	// 			"positive": [
	// 				"683",
	// 				0
	// 			],
	// 			"negative": [
	// 				"683",
	// 				1
	// 			],
	// 			"control_net": [
	// 				"671",
	// 				0
	// 			],
	// 			"image": [
	// 				"670",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"669",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"682": {
	// 		"inputs": {
	// 			"images": [
	// 				"670",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PreviewImage",
	// 		"_meta": {
	// 			"title": "预览图像"
	// 		}
	// 	},
	// 	"683": {
	// 		"inputs": {
	// 			"strength": 0.8500000000000002,
	// 			"start_percent": 0.5000000000000001,
	// 			"end_percent": 0.85,
	// 			"positive": [
	// 				"675",
	// 				0
	// 			],
	// 			"negative": [
	// 				"675",
	// 				1
	// 			],
	// 			"control_net": [
	// 				"665",
	// 				0
	// 			],
	// 			"image": [
	// 				"778",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"666",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"690": {
	// 		"inputs": {
	// 			"strength": 0.7500000000000001,
	// 			"start_percent": 0,
	// 			"end_percent": 0.65,
	// 			"positive": [
	// 				"661",
	// 				0
	// 			],
	// 			"negative": [
	// 				"661",
	// 				1
	// 			],
	// 			"control_net": [
	// 				"671",
	// 				0
	// 			],
	// 			"image": [
	// 				"670",
	// 				0
	// 			],
	// 			"weights_override": [
	// 				"668",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "ACN_AdvancedControlNetApply",
	// 		"_meta": {
	// 			"title": "Apply Advanced ControlNet 🛂🅐🅒🅝"
	// 		}
	// 	},
	// 	"691": {
	// 		"inputs": {
	// 			"merge_with_lineart": "lineart_standard",
	// 			"resolution": 2880,
	// 			"lineart_lower_bound": 0.6000000000000001,
	// 			"lineart_upper_bound": 0.5000000000000001,
	// 			"object_min_size": 36,
	// 			"object_connectivity": 1,
	// 			"image": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "AnyLineArtPreprocessor_aux",
	// 		"_meta": {
	// 			"title": "AnyLine Lineart"
	// 		}
	// 	},
	// 	"692": {
	// 		"inputs": {
	// 			"guassian_sigma": 8.000000000000002,
	// 			"intensity_threshold": 16,
	// 			"resolution": 2880,
	// 			"image": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LineartStandardPreprocessor",
	// 		"_meta": {
	// 			"title": "Standard Lineart"
	// 		}
	// 	},
	// 	"696": {
	// 		"inputs": {
	// 			"interpolation": "LANCZOS",
	// 			"crop_position": "pad",
	// 			"sharpening": 0.20000000000000004,
	// 			"image": [
	// 				"698",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PrepImageForClipVision",
	// 		"_meta": {
	// 			"title": "Prep Image For ClipVision"
	// 		}
	// 	},
	// 	"697": {
	// 		"inputs": {
	// 			"preset": "PLUS (high strength)",
	// 			"model": [
	// 				"52",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "IPAdapterUnifiedLoader",
	// 		"_meta": {
	// 			"title": "IPAdapter Unified Loader"
	// 		}
	// 	},
	// 	"698": {
	// 		"inputs": {
	// 			"brightness": 0,
	// 			"contrast": 1.0500000000000003,
	// 			"saturation": 1,
	// 			"sharpness": 1.2000000000000002,
	// 			"blur": 0,
	// 			"gaussian_blur": 0,
	// 			"edge_enhance": 0,
	// 			"detail_enhance": "false",
	// 			"image": [
	// 				"702",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Image Filter Adjustments",
	// 		"_meta": {
	// 			"title": "Image Filter Adjustments"
	// 		}
	// 	},
	// 	"700": {
	// 		"inputs": {
	// 			"0layer Weight": 0,
	// 			"1layer Weight": 0,
	// 			"2layer Weight": 0,
	// 			"3layer Weight": 0,
	// 			"4layer Weight": 0,
	// 			"5layer Weight": 0,
	// 			"6layer Weight": 1,
	// 			"7layer Weight": 0,
	// 			"8layer Weight": 0,
	// 			"9layer Weight": 0,
	// 			"10layer Weight": 0,
	// 			"11layer Weight": 0,
	// 			"Random": "No",
	// 			"seed": 474412368356611
	// 		},
	// 		"class_type": "EGIPAdapter_Mad_AssistantV6",
	// 		"_meta": {
	// 			"title": "IPAdapter Mad Assistant V6"
	// 		}
	// 	},
	// 	"702": {
	// 		"inputs": {
	// 			"size": 1536,
	// 			"interpolation_mode": "bilinear",
	// 			"image": [
	// 				"191",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "JWImageResizeByLongerSide",
	// 		"_meta": {
	// 			"title": "Image Resize by Longer Side"
	// 		}
	// 	},
	// 	"703": {
	// 		"inputs": {
	// 			"interpolation": "LANCZOS",
	// 			"crop_position": "pad",
	// 			"sharpening": 0.20000000000000004,
	// 			"image": [
	// 				"776",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "PrepImageForClipVision",
	// 		"_meta": {
	// 			"title": "Prep Image For ClipVision"
	// 		}
	// 	},
	// 	"705": {
	// 		"inputs": {
	// 			"weight": 1.0000000000000002,
	// 			"weight_faceidv2": 1,
	// 			"weight_type": "linear",
	// 			"combine_embeds": "concat",
	// 			"start_at": 0,
	// 			"end_at": 1,
	// 			"embeds_scaling": "V only",
	// 			"layer_weights": [
	// 				"706",
	// 				0
	// 			],
	// 			"model": [
	// 				"697",
	// 				0
	// 			],
	// 			"ipadapter": [
	// 				"697",
	// 				1
	// 			],
	// 			"image": [
	// 				"703",
	// 				0
	// 			],
	// 			"image_negative": [
	// 				"708",
	// 				0
	// 			],
	// 			"clip_vision": [
	// 				"707",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "IPAdapterMS",
	// 		"_meta": {
	// 			"title": "IPAdapter Mad Scientist"
	// 		}
	// 	},
	// 	"706": {
	// 		"inputs": {
	// 			"0layer Weight": 1,
	// 			"1layer Weight": 1,
	// 			"2layer Weight": 1,
	// 			"3layer Weight": 1,
	// 			"4layer Weight": 1,
	// 			"5layer Weight": 1,
	// 			"6layer Weight": 0.1,
	// 			"7layer Weight": 1,
	// 			"8layer Weight": 1,
	// 			"9layer Weight": 1,
	// 			"10layer Weight": 1,
	// 			"11layer Weight": 1,
	// 			"Random": "No",
	// 			"seed": 256257222514277
	// 		},
	// 		"class_type": "EGIPAdapter_Mad_AssistantV6",
	// 		"_meta": {
	// 			"title": "IPAdapter Mad Assistant V6"
	// 		}
	// 	},
	// 	"707": {
	// 		"inputs": {
	// 			"clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
	// 		},
	// 		"class_type": "CLIPVisionLoader",
	// 		"_meta": {
	// 			"title": "加载CLIP视觉"
	// 		}
	// 	},
	// 	"708": {
	// 		"inputs": {
	// 			"type": "gaussian",
	// 			"strength": 0.25000000000000006,
	// 			"blur": 0,
	// 			"image_optional": [
	// 				"702",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "IPAdapterNoise",
	// 		"_meta": {
	// 			"title": "IPAdapter Noise"
	// 		}
	// 	},
	// 	"709": {
	// 		"inputs": {
	// 			"size": 1536,
	// 			"interpolation_mode": "bilinear",
	// 			"image": [
	// 				"775",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "JWImageResizeByLongerSide",
	// 		"_meta": {
	// 			"title": "Image Resize by Longer Side"
	// 		}
	// 	},
	// 	"710": {
	// 		"inputs": {
	// 			"type": "gaussian",
	// 			"strength": 0.15000000000000002,
	// 			"blur": 0,
	// 			"image_optional": [
	// 				"709",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "IPAdapterNoise",
	// 		"_meta": {
	// 			"title": "IPAdapter Noise"
	// 		}
	// 	},
	// 	"711": {
	// 		"inputs": {
	// 			"weight": 0.7000000000000002,
	// 			"weight_faceidv2": 1,
	// 			"weight_type": "linear",
	// 			"combine_embeds": "concat",
	// 			"start_at": 0,
	// 			"end_at": 1,
	// 			"embeds_scaling": "V only",
	// 			"layer_weights": [
	// 				"700",
	// 				0
	// 			],
	// 			"model": [
	// 				"705",
	// 				0
	// 			],
	// 			"ipadapter": [
	// 				"697",
	// 				1
	// 			],
	// 			"image": [
	// 				"696",
	// 				0
	// 			],
	// 			"image_negative": [
	// 				"710",
	// 				0
	// 			],
	// 			"clip_vision": [
	// 				"707",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "IPAdapterMS",
	// 		"_meta": {
	// 			"title": "IPAdapter Mad Scientist"
	// 		}
	// 	},
	// 	"713": {
	// 		"inputs": {
	// 			"weight": 0.9000000000000001,
	// 			"style_boost": 1.0000000000000002,
	// 			"combine_embeds": "concat",
	// 			"start_at": 0.020000000000000004,
	// 			"end_at": 0.8500000000000002,
	// 			"embeds_scaling": "K+V",
	// 			"model": [
	// 				"711",
	// 				0
	// 			],
	// 			"ipadapter": [
	// 				"697",
	// 				1
	// 			],
	// 			"image": [
	// 				"696",
	// 				0
	// 			],
	// 			"clip_vision": [
	// 				"707",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "IPAdapterPreciseStyleTransfer",
	// 		"_meta": {
	// 			"title": "IPAdapter Precise Style Transfer"
	// 		}
	// 	},
	// 	"774": {
	// 		"inputs": {
	// 			"Input": 1,
	// 			"image1": [
	// 				"186",
	// 				0
	// 			],
	// 			"image2": [
	// 				"187",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "CR Image Input Switch",
	// 		"_meta": {
	// 			"title": "🔀 CR Image Input Switch"
	// 		}
	// 	},
	// 	"775": {
	// 		"inputs": {
	// 			"images": [
	// 				"149",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Images to RGB",
	// 		"_meta": {
	// 			"title": "Images to RGB"
	// 		}
	// 	},
	// 	"776": {
	// 		"inputs": {
	// 			"brightness": 0,
	// 			"contrast": 1.05,
	// 			"saturation": 1,
	// 			"sharpness": 1.2,
	// 			"blur": 0,
	// 			"gaussian_blur": 0,
	// 			"edge_enhance": 0,
	// 			"detail_enhance": "false",
	// 			"image": [
	// 				"775",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "Image Filter Adjustments",
	// 		"_meta": {
	// 			"title": "Image Filter Adjustments"
	// 		}
	// 	},
	// 	"777": {
	// 		"inputs": {
	// 			"brightness": 0.8,
	// 			"contrast": 2,
	// 			"saturation": 1,
	// 			"image": [
	// 				"691",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LayerColor: Brightness & Contrast",
	// 		"_meta": {
	// 			"title": "LayerColor: Brightness & Contrast"
	// 		}
	// 	},
	// 	"778": {
	// 		"inputs": {
	// 			"enhance": "sharp",
	// 			"images": [
	// 				"777",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LayerFilter: Sharp & Soft",
	// 		"_meta": {
	// 			"title": "LayerFilter: Sharp & Soft"
	// 		}
	// 	},
	// 	"779": {
	// 		"inputs": {
	// 			"brightness": 1.5,
	// 			"contrast": 2,
	// 			"saturation": 1,
	// 			"image": [
	// 				"692",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LayerColor: Brightness & Contrast",
	// 		"_meta": {
	// 			"title": "LayerColor: Brightness & Contrast"
	// 		}
	// 	},
	// 	"780": {
	// 		"inputs": {
	// 			"enhance": "very soft",
	// 			"images": [
	// 				"779",
	// 				0
	// 			]
	// 		},
	// 		"class_type": "LayerFilter: Sharp & Soft",
	// 		"_meta": {
	// 			"title": "LayerFilter: Sharp & Soft"
	// 		}
	// 	},
	// 	"782": {
	// 		"inputs": {
	// 			"positive": ""
	// 		},
	// 		"class_type": "easy positive",
	// 		"_meta": {
	// 			"title": "正面提示词"
	// 		}
	// 	},
	// 	"784": {
	// 		"inputs": {
	// 			"filename_prefix": "ComfyUI",
	// 			"images": [
	// 				"204",
	// 				5
	// 			]
	// 		},
	// 		"class_type": "SaveImage",
	// 		"_meta": {
	// 			"title": "保存图像"
	// 		}
	// 	}
	// },

	"extra_data": {
		"extra_pnginfo": {
			"workflow": {
				"id": "ec7da562-7e21-4dac-a0d2-f4441e1efd3b",
				"revision": 0,
				"last_node_id": 96,
				"last_link_id": 183,
				"nodes": [{
					"id": 38,
					"type": "CLIPLoader",
					"pos": [40, 190],
					"size": [346.391845703125, 106],
					"flags": {},
					"order": 0,
					"mode": 0,
					"inputs": [],
					"outputs": [{
						"name": "CLIP",
						"type": "CLIP",
						"slot_index": 0,
						"links": [74, 75]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CLIPLoader",
						"models": [{
							"name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
							"directory": "text_encoders"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["umt5_xxl_fp8_e4m3fn_scaled.safetensors", "wan", "default"]
				}, {
					"id": 60,
					"type": "CreateVideo",
					"pos": [1290, 0],
					"size": [270, 78],
					"flags": {},
					"order": 37,
					"mode": 0,
					"inputs": [{
						"name": "images",
						"type": "IMAGE",
						"link": 131
					}, {
						"name": "audio",
						"shape": 7,
						"type": "AUDIO",
						"link": null
					}],
					"outputs": [{
						"name": "VIDEO",
						"type": "VIDEO",
						"links": [132]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CreateVideo",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [16]
				}, {
					"id": 72,
					"type": "CLIPLoader",
					"pos": [40, 1810],
					"size": [346.391845703125, 106],
					"flags": {},
					"order": 1,
					"mode": 4,
					"inputs": [],
					"outputs": [{
						"name": "CLIP",
						"type": "CLIP",
						"slot_index": 0,
						"links": [161, 179]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CLIPLoader",
						"models": [{
							"name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors",
							"directory": "text_encoders"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["umt5_xxl_fp8_e4m3fn_scaled.safetensors", "wan", "default"]
				}, {
					"id": 73,
					"type": "ModelSamplingSD3",
					"pos": [640, 1550],
					"size": [210, 60],
					"flags": {},
					"order": 22,
					"mode": 4,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 159
					}],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [168]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "ModelSamplingSD3",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [8.000000000000002]
				}, {
					"id": 74,
					"type": "ModelSamplingSD3",
					"pos": [640, 1680],
					"size": [210, 58],
					"flags": {},
					"order": 23,
					"mode": 4,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 160
					}],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [175]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "ModelSamplingSD3",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [8]
				}, {
					"id": 76,
					"type": "UNETLoader",
					"pos": [30, 1550],
					"size": [346.7470703125, 82],
					"flags": {},
					"order": 2,
					"mode": 4,
					"inputs": [],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [159]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "UNETLoader",
						"models": [{
							"name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
							"directory": "diffusion_models"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "default"]
				}, {
					"id": 77,
					"type": "UNETLoader",
					"pos": [30, 1680],
					"size": [346.7470703125, 82],
					"flags": {},
					"order": 3,
					"mode": 4,
					"inputs": [],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [160]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "UNETLoader",
						"models": [{
							"name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
							"directory": "diffusion_models"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "default"]
				}, {
					"id": 78,
					"type": "CLIPTextEncode",
					"pos": [420, 2030],
					"size": [425.27801513671875, 180.6060791015625],
					"flags": {},
					"order": 20,
					"mode": 4,
					"inputs": [{
						"name": "clip",
						"type": "CLIP",
						"link": 161
					}],
					"outputs": [{
						"name": "CONDITIONING",
						"type": "CONDITIONING",
						"slot_index": 0,
						"links": [163]
					}],
					"title": "CLIP Text Encode (Negative Prompt)",
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CLIPTextEncode",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"],
					"color": "#322",
					"bgcolor": "#533"
				}, {
					"id": 79,
					"type": "VAELoader",
					"pos": [40, 1970],
					"size": [344.731689453125, 59.98149108886719],
					"flags": {},
					"order": 4,
					"mode": 4,
					"inputs": [],
					"outputs": [{
						"name": "VAE",
						"type": "VAE",
						"slot_index": 0,
						"links": [164, 173]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "VAELoader",
						"models": [{
							"name": "wan_2.1_vae.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors",
							"directory": "vae"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["wan_2.1_vae.safetensors"]
				}, {
					"id": 80,
					"type": "LoadImage",
					"pos": [50, 2140],
					"size": [315, 314],
					"flags": {},
					"order": 5,
					"mode": 4,
					"inputs": [],
					"outputs": [{
						"name": "IMAGE",
						"type": "IMAGE",
						"slot_index": 0,
						"links": [165]
					}, {
						"name": "MASK",
						"type": "MASK",
						"slot_index": 1,
						"links": null
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "LoadImage",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["ComfyUI_00592_.png", "image"]
				}, {
					"id": 81,
					"type": "WanFirstLastFrameToVideo",
					"pos": [430, 2340],
					"size": [410, 260],
					"flags": {},
					"order": 27,
					"mode": 4,
					"inputs": [{
						"name": "positive",
						"type": "CONDITIONING",
						"link": 162
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"link": 163
					}, {
						"name": "vae",
						"type": "VAE",
						"link": 164
					}, {
						"name": "clip_vision_start_image",
						"shape": 7,
						"type": "CLIP_VISION_OUTPUT",
						"link": null
					}, {
						"name": "clip_vision_end_image",
						"shape": 7,
						"type": "CLIP_VISION_OUTPUT",
						"link": null
					}, {
						"name": "start_image",
						"shape": 7,
						"type": "IMAGE",
						"link": 165
					}, {
						"name": "end_image",
						"shape": 7,
						"type": "IMAGE",
						"link": 166
					}],
					"outputs": [{
						"name": "positive",
						"type": "CONDITIONING",
						"links": [169, 176]
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"links": [170, 177]
					}, {
						"name": "latent",
						"type": "LATENT",
						"links": [171]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.48",
						"Node name for S&R": "WanFirstLastFrameToVideo",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [640, 640, 81, 1]
				}, {
					"id": 84,
					"type": "KSamplerAdvanced",
					"pos": [890, 1550],
					"size": [304.748046875, 334],
					"flags": {},
					"order": 30,
					"mode": 4,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 168
					}, {
						"name": "positive",
						"type": "CONDITIONING",
						"link": 169
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"link": 170
					}, {
						"name": "latent_image",
						"type": "LATENT",
						"link": 171
					}],
					"outputs": [{
						"name": "LATENT",
						"type": "LATENT",
						"links": [178]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "KSamplerAdvanced",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["enable", 183447983224434, "randomize", 20, 4, "euler", "simple", 0, 10, "enable"]
				}, {
					"id": 85,
					"type": "VAEDecode",
					"pos": [1240, 1550],
					"size": [210, 46],
					"flags": {},
					"order": 34,
					"mode": 4,
					"inputs": [{
						"name": "samples",
						"type": "LATENT",
						"link": 172
					}, {
						"name": "vae",
						"type": "VAE",
						"link": 173
					}],
					"outputs": [{
						"name": "IMAGE",
						"type": "IMAGE",
						"slot_index": 0,
						"links": [174]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "VAEDecode",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": []
				}, {
					"id": 86,
					"type": "CreateVideo",
					"pos": [1240, 1650],
					"size": [270, 78],
					"flags": {},
					"order": 36,
					"mode": 4,
					"inputs": [{
						"name": "images",
						"type": "IMAGE",
						"link": 174
					}, {
						"name": "audio",
						"shape": 7,
						"type": "AUDIO",
						"link": null
					}],
					"outputs": [{
						"name": "VIDEO",
						"type": "VIDEO",
						"links": [167]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CreateVideo",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [16]
				}, {
					"id": 87,
					"type": "KSamplerAdvanced",
					"pos": [900, 2270],
					"size": [304.748046875, 498.6905822753906],
					"flags": {},
					"order": 32,
					"mode": 4,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 175
					}, {
						"name": "positive",
						"type": "CONDITIONING",
						"link": 176
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"link": 177
					}, {
						"name": "latent_image",
						"type": "LATENT",
						"link": 178
					}],
					"outputs": [{
						"name": "LATENT",
						"type": "LATENT",
						"links": [172]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "KSamplerAdvanced",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["disable", 0, "fixed", 20, 4, "euler", "simple", 10, 10000, "disable"]
				}, {
					"id": 88,
					"type": "Note",
					"pos": [410, 2680],
					"size": [450, 120],
					"flags": {},
					"order": 6,
					"mode": 4,
					"inputs": [],
					"outputs": [],
					"title": "Video Size",
					"properties": {
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["By default, we set the video to a smaller size for users with low VRAM. If you have enough VRAM, you can change the size"],
					"color": "#432",
					"bgcolor": "#653"
				}, {
					"id": 90,
					"type": "CLIPTextEncode",
					"pos": [420, 1830],
					"size": [422.84503173828125, 164.31304931640625],
					"flags": {},
					"order": 21,
					"mode": 4,
					"inputs": [{
						"name": "clip",
						"type": "CLIP",
						"link": 179
					}],
					"outputs": [{
						"name": "CONDITIONING",
						"type": "CONDITIONING",
						"slot_index": 0,
						"links": [162]
					}],
					"title": "CLIP Text Encode (Positive Prompt)",
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CLIPTextEncode",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["冰晶组成的小猫突然被惊醒，愤怒的它抬头，渐渐长出色彩毛发变成为一个巨兽，像发现危险一样呲牙，瞪大眼睛"],
					"color": "#232",
					"bgcolor": "#353"
				}, {
					"id": 37,
					"type": "UNETLoader",
					"pos": [30, -70],
					"size": [346.7470703125, 82],
					"flags": {},
					"order": 7,
					"mode": 0,
					"inputs": [],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [180]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "UNETLoader",
						"models": [{
							"name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
							"directory": "diffusion_models"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "default"]
				}, {
					"id": 56,
					"type": "UNETLoader",
					"pos": [30, 60],
					"size": [346.7470703125, 82],
					"flags": {},
					"order": 8,
					"mode": 0,
					"inputs": [],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [182]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "UNETLoader",
						"models": [{
							"name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
							"directory": "diffusion_models"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "default"]
				}, {
					"id": 8,
					"type": "VAEDecode",
					"pos": [1290, -100],
					"size": [210, 46],
					"flags": {},
					"order": 35,
					"mode": 0,
					"inputs": [{
						"name": "samples",
						"type": "LATENT",
						"link": 124
					}, {
						"name": "vae",
						"type": "VAE",
						"link": 76
					}],
					"outputs": [{
						"name": "IMAGE",
						"type": "IMAGE",
						"slot_index": 0,
						"links": [131]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "VAEDecode",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": []
				}, {
					"id": 55,
					"type": "ModelSamplingSD3",
					"pos": [630, 320],
					"size": [210, 58],
					"flags": {},
					"order": 29,
					"mode": 0,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 183
					}],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [148]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "ModelSamplingSD3",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [5]
				}, {
					"id": 92,
					"type": "LoraLoaderModelOnly",
					"pos": [430, 190],
					"size": [420, 82],
					"flags": {},
					"order": 25,
					"mode": 0,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 182
					}],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"links": [183]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.49",
						"Node name for S&R": "LoraLoaderModelOnly",
						"models": [{
							"name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
							"directory": "loras"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {
								"lora_name": true,
								"strength_model": true
							}
						}
					},
					"widgets_values": ["wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", 1]
				}, {
					"id": 91,
					"type": "LoraLoaderModelOnly",
					"pos": [420, -70],
					"size": [430, 82],
					"flags": {},
					"order": 24,
					"mode": 0,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 180
					}],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"links": [181]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.49",
						"Node name for S&R": "LoraLoaderModelOnly",
						"models": [{
							"name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
							"directory": "loras"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {
								"lora_name": true,
								"strength_model": true
							}
						}
					},
					"widgets_values": ["wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", 1]
				}, {
					"id": 54,
					"type": "ModelSamplingSD3",
					"pos": [630, 60],
					"size": [210, 60],
					"flags": {},
					"order": 28,
					"mode": 0,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 181
					}],
					"outputs": [{
						"name": "MODEL",
						"type": "MODEL",
						"slot_index": 0,
						"links": [147]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "ModelSamplingSD3",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [5]
				}, {
					"id": 58,
					"type": "KSamplerAdvanced",
					"pos": [930, 470],
					"size": [304.748046875, 498.6905822753906],
					"flags": {},
					"order": 33,
					"mode": 0,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 148
					}, {
						"name": "positive",
						"type": "CONDITIONING",
						"link": 154
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"link": 155
					}, {
						"name": "latent_image",
						"type": "LATENT",
						"link": 113
					}],
					"outputs": [{
						"name": "LATENT",
						"type": "LATENT",
						"links": [124]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "KSamplerAdvanced",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["disable", 0, "fixed", 4, 1, "euler", "simple", 2, 10000, "disable"]
				}, {
					"id": 57,
					"type": "KSamplerAdvanced",
					"pos": [920, -100],
					"size": [304.748046875, 334],
					"flags": {},
					"order": 31,
					"mode": 0,
					"inputs": [{
						"name": "model",
						"type": "MODEL",
						"link": 147
					}, {
						"name": "positive",
						"type": "CONDITIONING",
						"link": 151
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"link": 152
					}, {
						"name": "latent_image",
						"type": "LATENT",
						"link": 153
					}],
					"outputs": [{
						"name": "LATENT",
						"type": "LATENT",
						"links": [113]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "KSamplerAdvanced",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["enable", 617227917937089, "randomize", 4, 1, "euler", "simple", 0, 2, "enable"]
				}, {
					"id": 61,
					"type": "SaveVideo",
					"pos": [1290, 140],
					"size": [710, 808],
					"flags": {},
					"order": 39,
					"mode": 0,
					"inputs": [{
						"name": "video",
						"type": "VIDEO",
						"link": 132
					}],
					"outputs": [],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "SaveVideo",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["video/ComfyUI", "auto", "auto"]
				}, {
					"id": 39,
					"type": "VAELoader",
					"pos": [40, 340],
					"size": [344.731689453125, 59.98149108886719],
					"flags": {},
					"order": 9,
					"mode": 0,
					"inputs": [],
					"outputs": [{
						"name": "VAE",
						"type": "VAE",
						"slot_index": 0,
						"links": [76, 156]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "VAELoader",
						"models": [{
							"name": "wan_2.1_vae.safetensors",
							"url": "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors",
							"directory": "vae"
						}],
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["wan_2.1_vae.safetensors"]
				}, {
					"id": 67,
					"type": "WanFirstLastFrameToVideo",
					"pos": [440, 1000],
					"size": [410, 260],
					"flags": {},
					"order": 26,
					"mode": 0,
					"inputs": [{
						"name": "positive",
						"type": "CONDITIONING",
						"link": 149
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"link": 150
					}, {
						"name": "vae",
						"type": "VAE",
						"link": 156
					}, {
						"name": "clip_vision_start_image",
						"shape": 7,
						"type": "CLIP_VISION_OUTPUT",
						"link": null
					}, {
						"name": "clip_vision_end_image",
						"shape": 7,
						"type": "CLIP_VISION_OUTPUT",
						"link": null
					}, {
						"name": "start_image",
						"shape": 7,
						"type": "IMAGE",
						"link": 157
					}, {
						"name": "end_image",
						"shape": 7,
						"type": "IMAGE",
						"link": 158
					}],
					"outputs": [{
						"name": "positive",
						"type": "CONDITIONING",
						"links": [151, 154]
					}, {
						"name": "negative",
						"type": "CONDITIONING",
						"links": [152, 155]
					}, {
						"name": "latent",
						"type": "LATENT",
						"links": [153]
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.48",
						"Node name for S&R": "WanFirstLastFrameToVideo",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": [640, 640, 81, 1]
				}, {
					"id": 93,
					"type": "MarkdownNote",
					"pos": [-510, 450],
					"size": [490, 180],
					"flags": {},
					"order": 10,
					"mode": 0,
					"inputs": [],
					"outputs": [],
					"title": "VRAM Usage",
					"properties": {
						"widget_ue_connectable": {}
					},
					"widgets_values": ["## GPU:RTX4090D 24GB\n\n| Model            | Size |VRAM Usage | 1st Generation | 2nd Generation |\n|---------------------|-------|-----------|---------------|-----------------|\n| fp8_scaled               |640*640| 84%               | ≈  536s              | ≈ 513s                   |\n| fp8_scaled +  4steps LoRA  | 640*640  | 89%                | ≈ 108s               | ≈ 71s                   |"],
					"color": "#432",
					"bgcolor": "#653"
				}, {
					"id": 94,
					"type": "MarkdownNote",
					"pos": [-500, -160],
					"size": [480, 550],
					"flags": {},
					"order": 11,
					"mode": 0,
					"inputs": [],
					"outputs": [],
					"title": "Model Links",
					"properties": {
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["[Tutorial](https://docs.comfy.org/tutorials/video/wan/wan2_2\n) | [教程](https://docs.comfy.org/zh-CN/tutorials/video/wan/wan2_2\n)\n\n**Diffusion Model**       \n- [wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors)\n- [wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors)\n\n**LoRA**\n\n- [wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors)\n- [wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors)\n\n**VAE**\n- [wan_2.1_vae.safetensors](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors)\n\n**Text Encoder**   \n- [umt5_xxl_fp8_e4m3fn_scaled.safetensors](https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors)\n\n\nFile save location\n\n```\nComfyUI/\n├───📂 models/\n│   ├───📂 diffusion_models/\n│   │   ├─── wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors\n│   │   └─── wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors\n│   ├───📂 loras/\n│   │   ├───wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors\n│   │   └───wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors\n│   ├───📂 text_encoders/\n│   │   └─── umt5_xxl_fp8_e4m3fn_scaled.safetensors \n│   └───📂 vae/\n│       └── wan_2.1_vae.safetensors\n```\n"],
					"color": "#432",
					"bgcolor": "#653"
				}, {
					"id": 95,
					"type": "MarkdownNote",
					"pos": [-370, 1460],
					"size": [350, 150],
					"flags": {},
					"order": 12,
					"mode": 0,
					"inputs": [],
					"outputs": [],
					"properties": {
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["1. Box-select then use Ctrl + B to enable\n2. If you don't want to run both groups simultaneously, don't forget to use **Ctrl + B** to disable the **fp8_scaled + 4steps LoRA** group after enabling the **fp8_scaled** group, or try the [partial - execution](https://docs.comfy.org/interface/features/partial-execution) feature."],
					"color": "#432",
					"bgcolor": "#653"
				}, {
					"id": 6,
					"type": "CLIPTextEncode",
					"pos": [430, 510],
					"size": [422.84503173828125, 164.31304931640625],
					"flags": {},
					"order": 18,
					"mode": 0,
					"inputs": [{
						"name": "clip",
						"type": "CLIP",
						"link": 74
					}],
					"outputs": [{
						"name": "CONDITIONING",
						"type": "CONDITIONING",
						"slot_index": 0,
						"links": [149]
					}],
					"title": "CLIP Text Encode (Positive Prompt)",
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CLIPTextEncode",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["A bearded man with red facial hair wearing a yellow straw hat and dark coat in Van Gogh's self-portrait style, slowly and continuously transforms into a space astronaut. The transformation flows like liquid paint - his beard fades away strand by strand, the yellow hat melts and reforms smoothly into a silver space helmet, dark coat gradually lightens and restructures into a white spacesuit. The background swirling brushstrokes slowly organize and clarify into realistic stars and space, with Earth appearing gradually in the distance. Every change happens in seamless waves, maintaining visual continuity throughout the metamorphosis.\n\nConsistent soft lighting throughout, medium close-up maintaining same framing, central composition stays fixed, gentle color temperature shift from warm to cool, gradual contrast increase, smooth style transition from painterly to photorealistic. Static camera with subtle slow zoom, emphasizing the flowing transformation process without abrupt changes."],
					"color": "#232",
					"bgcolor": "#353"
				}, {
					"id": 96,
					"type": "Note",
					"pos": [10, -310],
					"size": [360, 100],
					"flags": {},
					"order": 13,
					"mode": 0,
					"inputs": [],
					"outputs": [],
					"title": "About 4 Steps LoRA",
					"properties": {},
					"widgets_values": ["Using the Wan2.2 Lighting LoRA will result in the loss of video dynamics, but it will reduce the generation time. This template provides two workflows, and you can enable one as needed."],
					"color": "#432",
					"bgcolor": "#653"
				}, {
					"id": 89,
					"type": "LoadImage",
					"pos": [40, 2560],
					"size": [315, 314.00006103515625],
					"flags": {},
					"order": 14,
					"mode": 4,
					"inputs": [],
					"outputs": [{
						"name": "IMAGE",
						"type": "IMAGE",
						"slot_index": 0,
						"links": [166]
					}, {
						"name": "MASK",
						"type": "MASK",
						"slot_index": 1,
						"links": null
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "LoadImage",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["Qwen-Image_00002_.png", "image"]
				}, {
					"id": 70,
					"type": "Note",
					"pos": [890, 1160],
					"size": [340, 120],
					"flags": {},
					"order": 15,
					"mode": 0,
					"inputs": [],
					"outputs": [],
					"title": "Video Size",
					"properties": {
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["By default, we set the video to a smaller size for users with low VRAM. If you have enough VRAM, you can change the size"],
					"color": "#432",
					"bgcolor": "#653"
				}, {
					"id": 83,
					"type": "SaveVideo",
					"pos": [1240, 1790],
					"size": [770, 840],
					"flags": {},
					"order": 38,
					"mode": 4,
					"inputs": [{
						"name": "video",
						"type": "VIDEO",
						"link": 167
					}],
					"outputs": [],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "SaveVideo",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["video/ComfyUI", "auto", "auto"]
				}, {
					"id": 7,
					"type": "CLIPTextEncode",
					"pos": [430, 710],
					"size": [425.27801513671875, 180.6060791015625],
					"flags": {},
					"order": 19,
					"mode": 0,
					"inputs": [{
						"name": "clip",
						"type": "CLIP",
						"link": 75
					}],
					"outputs": [{
						"name": "CONDITIONING",
						"type": "CONDITIONING",
						"slot_index": 0,
						"links": [150]
					}],
					"title": "CLIP Text Encode (Negative Prompt)",
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "CLIPTextEncode",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"],
					"color": "#322",
					"bgcolor": "#533"
				}, {
					"id": 62,
					"type": "LoadImage",
					"pos": [50, 950],
					"size": [315, 314.00006103515625],
					"flags": {},
					"order": 16,
					"mode": 0,
					"inputs": [],
					"outputs": [{
						"name": "IMAGE",
						"type": "IMAGE",
						"slot_index": 0,
						"links": [158]
					}, {
						"name": "MASK",
						"type": "MASK",
						"slot_index": 1,
						"links": null
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "LoadImage",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["2.png", "image"]
				}, {
					"id": 68,
					"type": "LoadImage",
					"pos": [50, 520],
					"size": [315, 314.0000305175781],
					"flags": {},
					"order": 17,
					"mode": 0,
					"inputs": [],
					"outputs": [{
						"name": "IMAGE",
						"type": "IMAGE",
						"slot_index": 0,
						"links": [157]
					}, {
						"name": "MASK",
						"type": "MASK",
						"slot_index": 1,
						"links": null
					}],
					"properties": {
						"cnr_id": "comfy-core",
						"ver": "0.3.45",
						"Node name for S&R": "LoadImage",
						"enableTabs": false,
						"tabWidth": 65,
						"tabXOffset": 10,
						"hasSecondTab": false,
						"secondTabText": "Send Back",
						"secondTabOffset": 80,
						"secondTabWidth": 65,
						"ue_properties": {
							"widget_ue_connectable": {}
						}
					},
					"widgets_values": ["20250827-093404.jpg", "image"]
				}],
				"links": [
					[74, 38, 0, 6, 0, "CLIP"],
					[75, 38, 0, 7, 0, "CLIP"],
					[76, 39, 0, 8, 1, "VAE"],
					[113, 57, 0, 58, 3, "LATENT"],
					[124, 58, 0, 8, 0, "LATENT"],
					[131, 8, 0, 60, 0, "IMAGE"],
					[132, 60, 0, 61, 0, "VIDEO"],
					[147, 54, 0, 57, 0, "MODEL"],
					[148, 55, 0, 58, 0, "MODEL"],
					[149, 6, 0, 67, 0, "CONDITIONING"],
					[150, 7, 0, 67, 1, "CONDITIONING"],
					[151, 67, 0, 57, 1, "CONDITIONING"],
					[152, 67, 1, 57, 2, "CONDITIONING"],
					[153, 67, 2, 57, 3, "LATENT"],
					[154, 67, 0, 58, 1, "CONDITIONING"],
					[155, 67, 1, 58, 2, "CONDITIONING"],
					[156, 39, 0, 67, 2, "VAE"],
					[157, 68, 0, 67, 5, "IMAGE"],
					[158, 62, 0, 67, 6, "IMAGE"],
					[159, 76, 0, 73, 0, "MODEL"],
					[160, 77, 0, 74, 0, "MODEL"],
					[161, 72, 0, 78, 0, "CLIP"],
					[162, 90, 0, 81, 0, "CONDITIONING"],
					[163, 78, 0, 81, 1, "CONDITIONING"],
					[164, 79, 0, 81, 2, "VAE"],
					[165, 80, 0, 81, 5, "IMAGE"],
					[166, 89, 0, 81, 6, "IMAGE"],
					[167, 86, 0, 83, 0, "VIDEO"],
					[168, 73, 0, 84, 0, "MODEL"],
					[169, 81, 0, 84, 1, "CONDITIONING"],
					[170, 81, 1, 84, 2, "CONDITIONING"],
					[171, 81, 2, 84, 3, "LATENT"],
					[172, 87, 0, 85, 0, "LATENT"],
					[173, 79, 0, 85, 1, "VAE"],
					[174, 85, 0, 86, 0, "IMAGE"],
					[175, 74, 0, 87, 0, "MODEL"],
					[176, 81, 0, 87, 1, "CONDITIONING"],
					[177, 81, 1, 87, 2, "CONDITIONING"],
					[178, 84, 0, 87, 3, "LATENT"],
					[179, 72, 0, 90, 0, "CLIP"],
					[180, 37, 0, 91, 0, "MODEL"],
					[181, 91, 0, 54, 0, "MODEL"],
					[182, 56, 0, 92, 0, "MODEL"],
					[183, 92, 0, 55, 0, "MODEL"]
				],
				"groups": [{
					"id": 1,
					"title": "Step 1 - Load models",
					"bounding": [20, -150, 850, 570],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 2,
					"title": "Step 2.1 - Upload start_image",
					"bounding": [20, 440, 370, 410],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 3,
					"title": "Step 4 - Prompt",
					"bounding": [420, 440, 445.27801513671875, 464.2060852050781],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 4,
					"title": "Step 3 - Video size & length",
					"bounding": [420, 930, 450, 350],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 5,
					"title": "Step 2.2 - Upload end_image",
					"bounding": [20, 870, 370, 410],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 11,
					"title": "Wan2.2 I2V fp8_scaled",
					"bounding": [10, 1430, 2030, 1490],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 6,
					"title": "Step 1 - Load models",
					"bounding": [20, 1470, 371.0310363769531, 571.3974609375],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 7,
					"title": "Step 2.1 - Upload start_image",
					"bounding": [20, 2060, 370, 410],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 8,
					"title": "Step 4 -  Prompt",
					"bounding": [410, 1760, 445.27801513671875, 464.2060852050781],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 9,
					"title": "Step 3 - Video size & length",
					"bounding": [410, 2240, 450, 390],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 10,
					"title": "Step 2.2 - Upload end_image",
					"bounding": [20, 2490, 370, 410],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}, {
					"id": 12,
					"title": "Wan2.2 I2V fp8_scaled +  4 steps LoRA",
					"bounding": [10, -200, 2030, 1510],
					"color": "#3f789e",
					"font_size": 24,
					"flags": {}
				}],
				"config": {},
				"extra": {
					"ds": {
						"scale": 0.693433494944208,
						"offset": [313.60153058690764, 201.3426420681722]
					},
					"frontendVersion": "1.26.13",
					"VHS_latentpreview": false,
					"VHS_latentpreviewrate": 0,
					"VHS_MetadataImage": true,
					"VHS_KeepIntermediate": true,
					"ue_links": [],
					"links_added_by_ue": []
				},
				"version": 0.4
			}
		}
	}
}
export default data