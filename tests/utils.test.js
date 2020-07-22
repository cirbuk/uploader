import Resolver from "../src/index";

describe("_resolveString test", () => {
  it("should resolve mapping inside mapping", () => {
    const resolver = new Resolver();
    const data = {
      index: {
        value: 2
      },
      array: ["one", "two", "three"]
    };
    return expect(resolver._resolveString("{{array.{{index.value}}}}", data)).toEqual("three");
  });

  it("should resolve mapping inside mapping with other content", () => {
    const resolver = new Resolver();
    const data = {
      index: {
        value: 2
      },
      array: ["one", "two", "three"]
    };

    return expect(resolver._resolveString("This is a string " +
      "{{array.{{index.value}}}} that has a mapping in a mapping", data))
      .toEqual("This is a string three that has a mapping in a mapping");
  });

  it("should resolve multiple mapping inside mapping", () => {
    const resovler = new Resolver();
    const data = {
      index: {
        value: 2,
        value1: 0
      },
      array: ["one", "two", "three"]
    };

    return expect(resovler._resolveString("This is a string " +
      "{{array.{{index.value}}}} that has a mapping in a mapping and {{array.{{index.value1}}}}", data))
      .toEqual("This is a string three that has a mapping in a mapping and one");
  });

  it("should resolve multiple mapping inside mapping inside mapping", () => {
    const resolver = new Resolver();
    const data = {
      index: {
        value: 2,
        value1: 0
      },
      array: ["one", "two", ["three"]]
    };

    return expect(resolver._resolveString("This is a string " +
      "{{array.{{index.value}}.{{index.value1}}}} that has a mapping in a mapping", data))
      .toEqual("This is a string three that has a mapping in a mapping");
  });

  it("should resolve multiple mapping inside mapping inside mapping", () => {
    const resolver = new Resolver();
    const data = {
      property: "value",
      index: {
        value: 2,
        value1: 0
      },
      array: ["one", "two", ["3"]]
    };

    return expect(resolver._resolveString("This is a string " +
      "{{array.{{index.{{property}}||number}}.{{index.value1}}||number}} that has a mapping in a mapping", data))
      .toEqual("This is a string 3 that has a mapping in a mapping");
  });

});