# resolver

Resolver is capable of resolving any marked up JavaScript object/array/string against a data object.

## Installation

```JavaScript
npm install @kubric/resolver
```

or

```JavaScript
yarn add @kubric/resolver
```

## Usage

``` JavaScript
import Resolver from "@kubric/resolver"

//Data JSON
const data = {
  isFormData: false,
  appName: 'an_app',
  email: [{
    id: 'abc@gmail.com',
  }],
  mapValue: {
    data: {
      name: "tester",
      id: 1234
    }
  },
};

//Template JSON
const template = {
  method: 'post',
  isFormData: '{{isFormData}}',
  userId: 'userid_{{mapValue.data.id}}',
  data: {
    userid: '{{email.0.id}}',
    app_name: '{{appName}}',
  },
  extraData: '{{mapValue.data}}'
};

const resolver = new Resolver();
const resolvedData = resolver.resolve(template, data);

// resolvedData will be
// {
//   method: 'post',
//   isFormData: false,
//   userId: 'userid_1234',
//   data: {
//     userid: 'abc@gmail.com',
//     app_name: 'an_app'
//   },
//   extraData: {
//     name: "tester",
//     id: 1234
//   }
// }
```

## Default values

Default values can be provided in the markup, to support the case when the mapping path results in an `undefined` when resolved against the data

``` JavaScript
import Resolver from "@kubric/resolver"

//Data JSON
const data = {};

//Template JSON
const template = {
  method: 'post',
  isFormData: '{{isFormData|false}}',
  userId: 'userid_{{mapValue.data.id|1234}}',
  data: {
    userid: '{{email.0.id|abc@gmail.com}}',
    app_name: '{{appName|an_app}}',
  }
};

const resolver = new Resolver();
const resolvedData = resolver.resolve(template, data);

// resolvedData will be
// {
//   method: 'post',
//   isFormData: 'false',
//   userId: 'userid_1234',
//   data: {
//     userid: 'abc@gmail.com',
//     app_name: 'an_app'
//   }
// }
```

## Type conversion

By default, the resolver always resolve to whatever type is returned from the data. This behavior can be altered by forcing a type conversion. The following 7 types are supported - `number`, `object`, `array`, `string`, `boolean` and `null`.

```JavaScript
import Resolver from "@kubric/resolver"

//Data JSON
const data = {
  once: 1,
  numberstring: "3",
  number: 4,
  stringnumber: 10,
  booleanstring: "test",
  boolean: true,
  array: [1],
  object: {
    one: 1
  },
  objectstring: '{"four":4}',
  null: 5
};

//Template JSON
const template = {
  //{{data.once|5}} = 1 resolved from data. Default value "5" is ignored
  //{{data.twice|2}} = "2" resolved from default value.
  withinstring: "replacing within string once {{data.once|5}} and twice {{data.twice|2}}",

  //{{data.notypedefault|5}} = "5" resolved from default value
  notypedefault: "{{data.notypedefault|5}}",

  //{{data.numberstring||number}} = 3 resolved from data.numberstring("3") and
  //converted to number(3)
  numberstring: "{{data.numberstring||number}}",

  //{{data.number||number}} = 4 resolved from data.number(4) and converted to
  //number(4)
  number: "{{data.number||number}}",

  //{{data.numberdefault|5|number}} = 5 resolved from defaultValue("5") and
  //converted to number(5)
  numberdefault: "{{data.numberdefault|5|number}}",

  //{{data.stringnumber||string}} = "10" resolved from data.stringnumber(10) and
  //converted to string("10")
  stringnumber: "{{data.stringnumber||string}}",

  //{{data.stringdefault|test|string}} = "test" resolved from default value("test")
  stringdefault: "{{data.stringdefault|test|string}}",

  //boolean type resolves to true for boolean true and string "true". It resolve
  //to false for everything else
  //{{data.booldefault|test|boolean}} = false resolved from default value("test").
  booldefault: "{{data.booldefault|test|boolean}}",

  //{{data.boolfalsedefault|true|boolean}} = true resolved from default value
  //("true").
  booltruedefault: "{{data.boolfalsedefault|true|boolean}}",

  //{{data.booleanstring||boolean}} = false resolved from data.booleanstring
  //("test").
  booleanstring: "{{data.booleanstring||boolean}}",

  //{{data.boolean||boolean}} = true resolved from data.boolean(true).
  boolean: "{{data.boolean||boolean}}",

  //{{data.array|[2,3]|array}} = [1] resolved from data.array([1])
  array: "{{data.array|[2,3]|array}}",

  //{{data.defaultarray|[2,3]|array}} = [2,3] resolved from default value("[2,3]")
  //and converted to array([2,3])
  defaultarray: "{{data.defaultarray|[2,3]|array}}",

  //{{data.defaultarray|[2,3]}} = "[2,3]" resolved from default value("[2,3]")
  arraystring: "{{data.defaultarray|[2,3]}}",

  //{{data.object|{"two": 2, "three": 3}|object}} = {"one":1} resolved from
  //data.object({"one":1})
  object: '{{data.object|{"two": 2, "three": 3}|object}}',

  //{{data.defaultobject|{"two": 2, "three": 3}|object}} = {"two":2,"three":3}
  //resolved from default value('{"two": 2, "three": 3}') and converted to object
  //({"two": 2, "three": 3})
  defaultobject: '{{data.defaultobject|{"two": 2, "three": 3}|object}}',

  //{{data.defaultobject|{"two": 2, "three": 3}}} = '{"two": 2, "three": 3}'
  //resolved from default value('{"two": 2, "three": 3}')
  defaultobjectstring: '{{data.defaultobject|{"two": 2, "three": 3}}}',

  //{{data.objectstring||object}} = {"four": 4} resolved from data.objectstring
  //('{"four": 4}') and converted to object({"four": 4})
  objectstring: '{{data.objectstring||object}}',

  //null is a special type. If the type is null and the mapping results in an
  //undefined value, the mapping resolved to null
  //{{data.nulldefault||null}} = null as data.nulldefault returns undefined
  nulldefault: '{{data.nulldefault||null}}',

  //{{data.null||null}} = 5 resolved from data.null(5)
  null: '{{data.null||null}}',
};

const resolver = new Resolver();
const resolvedData = resolver.resolve(template, data);

// resolvedData will be
// {
//   withinstring: "replacing within string once 1 and twice 2",
//   notypedefault: "5",
//   numberstring: 3,
//   number: 4,
//   numberdefault: 5,
//   stringnumber: "10",
//   stringdefault: "test",
//   booldefault: false,
//   booltruedefault: true,
//   booleanstring: false,
//   boolean: true,
//   array: [1],
//   defaultarray: [2, 3],
//   arraystring: "[2,3]",
//   defaultobjectstring: '{"two": 2, "three": 3}',
//   defaultobject: {
//     two: 2,
//     three: 3
//   },
//   object: {
//     one: 1
//   },
//   objectstring: {
//     four: 4
//   },
//   nulldefault: null,
//   null: 5
// }
```

## Transformers

Transformers can be defined in the template when extracted data need to be transformed before being applied.

In the template if any of the properties have as its value, an object with just the 2 properties `_mapping` and `_transformer` where `_transformer` is a function, then the resolver will resolve the mapping string from the data object and get the value resolved by passing it to the transformer function.

``` JavaScript
import Resolver from "@kubric/resolver"

const data = {
  isFormData: false,
};

const template = {
  method: 'post',
  isFormData: {
    //resolves to false
    _mapping: "{{isFormData}}",

    //The value false resolved using the _mapping is passed to the function. The
    //value that the function returns will become the value of isFormData
    _transformer(value) {
      return value === false ? "This is a false value" : "This is a true value";
    }
  }
};

const resolver = new Resolver();
const resolvedData = resolver.resolve(template, data);

// resolvedData will be
// {
//   isFormData: 'This is a false value',
// }
```

Transformers can be defined in 3 places

1. mapping: This transformer affects only the mapping for which it is defined. eg. The transformer defined in the above code. A mapping transformer, if defined will always be called.
2. `resolve()` function call: When `resolve()` is called, a `transformer` function can be passed in the `options`(see [resolve()](#resolver.resolve())). This transformer will be called for every mapping in the template, other than the mappings that have a transformer already defined.
3. `new Resolver()`: When a resolver instance is created, a transformer can b e passed in the `options`(see [options](#options)). This transformer will be called for all mappings for all calls to the `resolve()` function.

Rules for transformer invocation are as follows

1. Only one transformer will be called for a mapping
2. Order of precedence of if transformers have been defined in multiple levels - mapping > `resolve()` > `new Resolver()`

## Mappers

The resolver's default behavior is to try and replace everything between `{{` and `}}` with values from the data json. `mappers` can be used to define other markup operators.

```JavaScript
import Resolver from "@kubric/resolver"
import math from "math-expression-evaluator";

const data = {
  val1: "1",
  val2: "2",
  val3: "3",
  val4: "4",
};

const evaluators = {
  math: (match, formula) => {
    try {
      return +math.eval(formula);
    } catch (ex) {
      return match;
    }
  }
};

const template = {
  //Multiple mappings are used inside a string here. So the values returned by
  //the evaluator will be replaced into the string. The final value here will
  //be the string "3 and 7"
  calculatedStringValue: "[[{{val1}} + {{val2}}]] and [[{{val3}} + {{val4}}]]",
  
  //The entire string is one mapping. So value returned by the evaluator will be
  //assigned as such. The final value here will be the number 5
  calculatedNumberValue: "[[{{val1}} + {{val4}}]]"
};

//Anything that is enclosed within [[ and ]] will be passed to the math evaluator
const resolver = new Resolver({
  //Anything enclosed between [[ and ]] will be sent to the math evaluator
  mappers: [
    [/\[\[(.+?)]]/g, evaluators.math]
  ]
});

const resolvedData = resolver.resolve(template, data);
// resolvedData will be
// {
//     calculatedStringValue: '3 and 7',
//     calculatedNumberValue: 5
// }
```

> `mappers` take effect only after standard mappings(mappings between `{{` and `}}`) are resolved and the transformer pipeline has been executed. The standard mapping operator cannot be overridden using custom mappers.

## Nested mapping

``` JavaScript
import Resolver from "@kubric/resolver"

//Data JSON
const data = {
  property: "value",
  index: {
    value: "2",
    value1: 0
  },
  array: ["one", "two", ["3"]]
};

//Template JSON
const template = {
  string: "This is a string that has been resolved from a " +
    "{{array.{{index.{{property}}||number}}.{{index.value1}}||number}} level nested mapping"
};

const resolver = new Resolver();
const resolvedData = resolver.resolve(template, data);

// resolvedData will be
// {
//   string: "This is a string that has been resolved from a 3 level nested mapping"
// }
// {{property}} - Resolves to "value" and the mapping becomes {{array.{{index.value||number}}.{{index.value1}}||number}}
// {{index.value||number}} - Resolves to 2 and the mapping becomes {{array.2.{{index.value1}}||number}}
// {{index.value1}} - Resolves to 0 and the mapping becomes {{array.2.0||number}}
// {{array.2.0||number}} - Resolves to 3
```

## API

### new Resolver(options)

Creates a new Resolver instance

#### options

`options` should be an object with the following properties

Property | Description | Remarks
---------|-------------|----------
replaceUndefinedWith | If a mapping path does not exist or is marked as `undefined` in the data json, the value of that mapping is taken to be `undefined`. `replaceUndefinedWith` can be used to replace such missing mappings with a custom value. | optional
ignoreUndefined | If `true`, mappings that do not exist or returns `undefined` from the data json will be ignored and left as is without resolving them. | optional <br/><br/> Default value: `false`.
transformer| Resolver instance level transformer can be defined here | optional <br/><br/> See [Transformers](#Transformers)
mappers | Used to define custom markup operators and their behavior | optional <br/><br/> Refer [mappers](#mappers)
delimiter | Sets the delimiter pattern that is used to delimit between mapping, default value and type in a mapping string. | optional <br/><br/> Default value: `|`
fields | It accepts an object with string properties `mapping` and `transformer` whose values will replace `_mapping` and `_transformer` as the keywords while defining a transformer for a single mapping. | optional <br/><br/> Defaults to `{ mapping: "_mapping", tranformer: "_transformer" }`

### resolver.resolve(template, data, options)

Property | Description | Remarks
---------|-------------|----------
template | JS object/string/array that needs to be resolved against `data` | required
data | JSON object against which the `template` will be resolved | optional
options.transformer | If defined, this function will be called to transform the value of every mapping defined in `template` except if there is an exclusive transformer defined for a mapping | optional <br/><br/> See [Transformers](#Transformers)
options.mappers | If defined, will override the `mappers` defined at an instance level for that invocation of the `resolve()` function | optional <br/><br/> Refer [mappers](#mappers)
