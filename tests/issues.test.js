import Resolver from "../src";
import _ from "lodash";
import math from "math-expression-evaluator";
import safeEval from "safe-eval";

const mathResolver = (match, formula) => {
  try {
    return +math.eval(formula);
  } catch (ex) {
    return match;
  }
};

const evalResolver = (match, formula) => {
  try {
    return +safeEval(formula);
  } catch (ex) {
    return match;
  }
};

describe("Resolver issues", () => {
  it("Issue with template having function being resolved to empty object", () => {
    const resolver = new Resolver();
    const resolvedData = resolver.resolve([
      "{{req._sessionData}}",
      () => ({
        test: 35
      })
    ], {
      req: {
        _sessionData: {
          data: "session"
        }
      }
    });
    const results = resolvedData.reduce((acc, dataPart = {}) => ({
      ...acc,
      ...(_.isFunction(dataPart) ? dataPart() : dataPart)
    }), {});
    return expect(results).toEqual({
      data: "session",
      test: 35
    });
  });

  it("Issue with nested mapping", () => {
    const resolver = new Resolver();
    const resolvedData = resolver.resolve("{{{{widthParameter}}||number}}", {
      "widthParameter": "width",
      "width": "960"
    }, {
      mappers: [
        [/^\[\[(.+?)\]\]$/, mathResolver],
        [/\[\[(.+?)\]\]/g, mathResolver],
        [/eval\((.+)\)/, evalResolver]
      ]
    });
    return expect(resolvedData).toEqual(960);
  });

  /*
  The `}}` inserted into the template by the stringified JSON while resolving segment_attributes
  was resulting in an infinite loop
   */
  it("Issue from kubric service ware", () => {
    const resolver = new Resolver();
    const template = [
      "{{req._sessionData}}",
      {
        "campaign_id": "{{req.params.campaign}}",
        "creative_id": "{{req.params.ad}}",
        "storyboard_id": "{{req._sbId}}",
        "segment_attributes": "{{req._segmentAttrs}}"
      }
    ];
    const data = {
      req: {
        _sessionData: {
          userid: "HZ3vEOQJTBZBw1JrVSh9A65a0v73",
          email: "jophin@kubric.io",
          name: "Jophin Joseph",
          photo: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg",
          timezone: 330,
          workspace_id: "a95052e0-d520-4ef5-8e44-7ab344ebb24f",
          roles: {
            creator: true
          },
          profile_image_url: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg",
          background_image_url: "",
          desc: "This is my bio",
          phone_no: "1234567",
          apps: [],
          firstTimeLogin: false,
          token: "4847UV00d9SMKOT1HSUVjV8CRlfHStNIerumUMAhCZGWSAI4H6fqJDROBt5sB2E/Vh+dhkDBA86cCLG6EmwXpg4Og0dbfqVaNiE+EaXWcgg=",
          settings: {}
        },
        params: {
          campaign: "d03edb0c-2892-484d-b17f-dbd6bca07115",
          ad: "186df696-3b19-4d39-846b-d7e388f43cef"
        },
        _sbId: "c474dc87-236b-4f30-93a0-ea6e10fdb81f",
        _segmentAttrs: "‌{\"merchant_id\": \"DL0004690\", \"merchant_name\": \"Super Store - Jamia\", \"store_id\": \"28776\", \"city\": \"Delhi\", \"promo_id\": \"71893\", \"banner_type\": \"N*N Price-only\", \"pid_1\": \"103273\", \"pid_2\": \"\", \"backup_pid_1\": \"326348\", \"backup_pid_2\": \"\", \"banner_start_date\": \"02-01-20\", \"banner_end_date\": \"03-01-20\", \"le\": \"1\", \"cms\": \"1\", \"s1/product_1\": \"https://storage.googleapis.com/assetlib/8051a5cb-ea67-4c22-b931-b7bccbdfc286.png\", \"s1/product_1_title\": \"Fortune\", \"s1/pdt1_pos\": {\"y\": 250, \"x\": 225}, \"s1/product1_offer_price_fontsize\": 94, \"s1/product_1_unit\": \"700g\", \"s1/product1_unit-y_original\": 280, \"s1/product1_unit-y\": 280, \"s1/product1_offer_price\": \"103\", \"s1/product1_rs_fontsize\": 90, \"s1/pdt1_zoom\": 1, \"s1/canvas-size\": {\"h\": 640, \"w\": 720}}\n"
      }
    };
    const resolvedTemplate = resolver.resolve(template, data);
    return expect(resolvedTemplate).toEqual([
      {
        userid: "HZ3vEOQJTBZBw1JrVSh9A65a0v73",
        email: "jophin@kubric.io",
        name: "Jophin Joseph",
        photo: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg",
        timezone: 330,
        workspace_id: "a95052e0-d520-4ef5-8e44-7ab344ebb24f",
        roles: {
          creator: true
        },
        profile_image_url: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg",
        background_image_url: "",
        desc: "This is my bio",
        phone_no: "1234567",
        apps: [],
        firstTimeLogin: false,
        token: "4847UV00d9SMKOT1HSUVjV8CRlfHStNIerumUMAhCZGWSAI4H6fqJDROBt5sB2E/Vh+dhkDBA86cCLG6EmwXpg4Og0dbfqVaNiE+EaXWcgg=",
        settings: {}
      },
      {
        campaign_id: "d03edb0c-2892-484d-b17f-dbd6bca07115",
        creative_id: "186df696-3b19-4d39-846b-d7e388f43cef",
        storyboard_id: "c474dc87-236b-4f30-93a0-ea6e10fdb81f",
        segment_attributes: "‌{\"merchant_id\": \"DL0004690\", \"merchant_name\": \"Super Store - Jamia\", \"store_id\": \"28776\", \"city\": \"Delhi\", \"promo_id\": \"71893\", \"banner_type\": \"N*N Price-only\", \"pid_1\": \"103273\", \"pid_2\": \"\", \"backup_pid_1\": \"326348\", \"backup_pid_2\": \"\", \"banner_start_date\": \"02-01-20\", \"banner_end_date\": \"03-01-20\", \"le\": \"1\", \"cms\": \"1\", \"s1/product_1\": \"https://storage.googleapis.com/assetlib/8051a5cb-ea67-4c22-b931-b7bccbdfc286.png\", \"s1/product_1_title\": \"Fortune\", \"s1/pdt1_pos\": {\"y\": 250, \"x\": 225}, \"s1/product1_offer_price_fontsize\": 94, \"s1/product_1_unit\": \"700g\", \"s1/product1_unit-y_original\": 280, \"s1/product1_unit-y\": 280, \"s1/product1_offer_price\": \"103\", \"s1/product1_rs_fontsize\": 90, \"s1/pdt1_zoom\": 1, \"s1/canvas-size\": {\"h\": 640, \"w\": 720}}\n"
      }
    ]);
  });

  it("Issue from kubric service ware variation test", () => {
    const resolver = new Resolver();
    const template = "What happens if this template  - {{req._segmentAttrs}} - injects }} in between";
    const data = {
      req: {
        _segmentAttrs: "‌{\"merchant_id\": \"DL0004690\", \"merchant_name\": \"Super Store - Jamia\", \"store_id\": \"28776\", \"city\": \"Delhi\", \"promo_id\": \"71893\", \"banner_type\": \"N*N Price-only\", \"pid_1\": \"103273\", \"pid_2\": \"\", \"backup_pid_1\": \"326348\", \"backup_pid_2\": \"\", \"banner_start_date\": \"02-01-20\", \"banner_end_date\": \"03-01-20\", \"le\": \"1\", \"cms\": \"1\", \"s1/product_1\": \"https://storage.googleapis.com/assetlib/8051a5cb-ea67-4c22-b931-b7bccbdfc286.png\", \"s1/product_1_title\": \"Fortune\", \"s1/pdt1_pos\": {\"y\": 250, \"x\": 225}, \"s1/product1_offer_price_fontsize\": 94, \"s1/product_1_unit\": \"700g\", \"s1/product1_unit-y_original\": 280, \"s1/product1_unit-y\": 280, \"s1/product1_offer_price\": \"103\", \"s1/product1_rs_fontsize\": 90, \"s1/pdt1_zoom\": 1, \"s1/canvas-size\": {\"h\": 640, \"w\": 720}}\n"
      }
    };
    const resolvedTemplate = resolver.resolve(template, data);
    return expect(resolvedTemplate).toEqual("What happens if this template  - ‌{\"merchant_id\": \"DL0004690\", \"merchant_name\": \"Super Store - Jamia\", \"store_id\": \"28776\", \"city\": \"Delhi\", \"promo_id\": \"71893\", \"banner_type\": \"N*N Price-only\", \"pid_1\": \"103273\", \"pid_2\": \"\", \"backup_pid_1\": \"326348\", \"backup_pid_2\": \"\", \"banner_start_date\": \"02-01-20\", \"banner_end_date\": \"03-01-20\", \"le\": \"1\", \"cms\": \"1\", \"s1/product_1\": \"https://storage.googleapis.com/assetlib/8051a5cb-ea67-4c22-b931-b7bccbdfc286.png\", \"s1/product_1_title\": \"Fortune\", \"s1/pdt1_pos\": {\"y\": 250, \"x\": 225}, \"s1/product1_offer_price_fontsize\": 94, \"s1/product_1_unit\": \"700g\", \"s1/product1_unit-y_original\": 280, \"s1/product1_unit-y\": 280, \"s1/product1_offer_price\": \"103\", \"s1/product1_rs_fontsize\": 90, \"s1/pdt1_zoom\": 1, \"s1/canvas-size\": {\"h\": 640, \"w\": 720}}\n - injects }} in between");
  });

  it("Issue with resolving mapping in services", () => {
    const resolver = new Resolver({
      ignoreUndefined: true
    });
    const template = {
      "app_name": "{{appName}}",
      "workspace_name": "{{__transformers.shopMapping}}",
      "verified": 1,
    };
    const _transformer = value => value.replace(".myshopify.com", "");
    const shopMapping = {
      "_mapping": "{{shop}}",
      _transformer
    };
    const data = {
      __transformers: {
        shopMapping: () => shopMapping
      }
    };
    const expected = {
      "app_name": "{{appName}}",
      "workspace_name": data.__transformers.shopMapping,
      "verified": 1
    };
    const resolvedTemplate = resolver.resolve(template, data);
    return expect(resolvedTemplate).toEqual(expected);
  });

  it("Issue with ignoreUndefined in nested mapping", () => {
    const resolver = new Resolver({
      ignoreUndefined: true
    });
    const bindings = {
      "default": 60,
      "hideInSheet": true,
      "editorMeta": {
        "group": "5. Adv Options",
        "min": 0,
        "max": 100,
        "step": 1,
        "type": "range",
        "order": 26,
        "suggest": {
          "request": {
            "font_url": "{{fonturl1}}",
            "text": "{{heading_line1}}",
            "type": "text_wrap",
            "width": 410,
            "height": 95,
            "max_font_size": 60
          },
          "patch": {
            "heading_line1": "{{text_with_new_lines}}",
            "heading_fontsize": "{{font_size}}"
          }
        }
      },
      "title": "Title Font Size",
      "meta": {
        "colId": "heading_fontsize",
        "colIndex": 24,
        "colTitle": "shot 1:Title Font Size"
      },
      "shouldParametrize": true
    };
    const template = {
      uid: "123",
      bindings: {
        "_mapping": "{{bindings}}",
        "_transformer": value => JSON.stringify(value)
      }
    };
    const resolvedTemplate = resolver.resolve(template, {
      bindings
    });
    return expect(resolvedTemplate).toEqual({
      uid: "123",
      bindings: JSON.stringify(bindings)
    });
  });

  it("Issue with mapping in analytics MM", () => {
    const resolver = new Resolver();
    const idMapping = field => ({
      _mapping: `{{${field}}}`,
      _transformer: id => id.split("/").pop()
    });
    const dataTemplate = {
      "pid": idMapping("product"),
      "iid": idMapping("image"),
      "hasOriginalImage": "{{hasSavedImage}}"
    };
    const resolvedTemplate = resolver.resolve(dataTemplate, {
      "product": "gid://shopify/Product/5364528251041",
      "image": "gid://shopify/ProductImage/17932841582753",
      "hasSavedImage": false,
      "store": "garima-test-09"
    });
    return expect(resolvedTemplate).toEqual({
      pid: "5364528251041",
      iid: "17932841582753",
      hasOriginalImage: false
    });
  })
});