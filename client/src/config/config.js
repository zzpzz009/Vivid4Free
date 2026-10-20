import json1 from '@/json/1.json'//预览
import json2 from '@/json/2.json'//生成
import washV64SingleUpscale from '@/json/wash_v64_single_upscale.json'//洗图
import vividKleinOutpaintApi from '@/json/vivid_klein_outpaint_api.json'
import vividKleinInpaintApi from '@/json/vivid_klein_inpaint_ui_legacy.json'
import vividKleinImageEditApi from '@/json/vivid_klein_image_edit_api.json'
// src/config/config.js

export default {
  
  BASE_URL : '',
  WS_URL : '',
  
  iframeurl: '/comfy',
  creativeIframeUrl: '',
  // Account integration is intentionally deferred in this local client.
  auth: {
    status: 'deferred'
  },
  
  config:{
    weather:[
      '',
      'Transform this image into a serene morning scene,',
      'Transform this image into a captivating nocturnal scene，he interior office space is faintly visible through the glass, with some offices randomly illuminated.',
      'Transform this image into a twilight scene，he interior office space is faintly visible through the glass, with some offices randomly illuminated.',
      'Transform this image to a daytime scene，he interior office space is faintly visible through the glass, with some offices randomly illuminated.'
    ],
    scene:[
      '',
      'enrich the grassland with lush vegetation,',
      'and enrich the grassland with lush vegetation, add vehicles to the road, and include people on the paved ground.',
      'and enrich the grassland with lush vegetation and add people to the paved ground,',
      'and enrich the grassland with lush vegetation, and add people and commercial displays to the paved ground,'
    ],

    yl:{//预览
      jsonfile:json1,//导入json
      // input:{//输入的号码
      //   dcl:'536',//待处理
      //   ck:'605',//参考
      //   tsc:'762'//提示词
      // },
      // output:{
      //   img:'1085'//输出
      // }
      input:{
        dcl:'536',//待处理
        ck:'605',//参考
        tsc:'762',//提示词
        seed:'1399',// 种子
        jx:'735',// 镜像
        ckpp:'1322',// 参考图匹配
        yspp:'1323',// 颜色匹配
        tjpj:'1415',// 添加配景
        zpfy:'1414'// 外置智谱反推
      },
      output:{
        // img:'575'//输出
        img:'622'//输出
      }
    },
    sc:{//洗图
      jsonfile:washV64SingleUpscale,//导入json
      input:{//输入的号码
        dcl:'138',
        cc:'791',
        chfd:'166',//重绘幅度
      },
      output:{
        img:'346'
      }
    },
    outpaint:{
      jsonfile:vividKleinOutpaintApi,
      input:{
        dcl:'31',
        tsc:'22',
        pad:'32',
        seed:'13'
      },
      output:{
        img:'36',
        compare:'34'
      }
    },
    inpaint:{
      jsonfile:vividKleinInpaintApi,
      input:{
        dcl:'34',
        tsc:'39'
      },
      output:{
        img:'48',
        compare:'50'
      }
    },
    imageEdit:{
      jsonfile:vividKleinImageEditApi,
      input:{
        dcl:'28',
        tsc:'29'
      },
      output:{
        img:'33',
        compare:'30'
      }
    }
  }
}
