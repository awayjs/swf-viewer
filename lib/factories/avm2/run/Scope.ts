import { AXGlobal } from "./AXGlobal";
import { Errors } from "../errors";
import { CONSTANT } from "../abc/lazy/CONSTANT";
import { Multiname } from "../abc/lazy/Multiname";
import { Namespace } from "../abc/lazy/Namespace";
import { AXObject } from "./AXObject";

export class Scope {
    parent: Scope;
    global: Scope;
    object: AXObject;
    isWith: boolean;
    cache: any;
    defaultNamespace: Namespace;
  
    constructor(parent: Scope, object: any, isWith: boolean = false) {
      this.parent = parent;
      this.object = object;
      this.global = parent ? parent.global : this;
      this.isWith = isWith;
      this.cache = [];
      this.defaultNamespace = null;
    }
  
    public findDepth(object: any): number {
      var current:Scope = this;
      var depth = 0;
      while (current) {
        if (current.object === object) {
          return depth;
        }
        depth++;
        current = current.parent;
      }
      return -1;
    }
  
    public getScopeObjects(): Object [] {
      var objects = [];
      var current:Scope = this;
      while (current) {
        objects.unshift(current.object);
        current = current.parent;
      }
      return objects;
    }
  
    public getScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): any {
      return this.findScopeProperty(mn, strict, scopeOnly).axGetProperty(mn);
    }
  
    public findScopeProperty(mn: Multiname, strict: boolean, scopeOnly: boolean): any {
      // Multinames with a `null` name are the any name, '*'. Need to catch those here, because
      // otherwise we'll get a failing assert in `RuntimeTraits#getTrait` below.
      if (mn.name === null) {
        this.global.object.sec.throwError('ReferenceError', Errors.UndefinedVarError, '*');
      }
      var object;
      if (!scopeOnly && !mn.isRuntime()) {
        if ((object = this.cache[mn.id])) {
          return object;
        }
      }
      // Scope lookups should not be trapped by proxies. Except for with scopes, check only trait
      // properties.
      if (this.object && (this.isWith ?
                          this.object.axHasPropertyInternal(mn) :
                          this.object.traits.getTrait(mn.namespaces, mn.name))) {
        return (this.isWith || mn.isRuntime()) ? this.object : (this.cache[mn.id] = this.object);
      }
      if (this.parent) {
        var object = this.parent.findScopeProperty(mn, strict, scopeOnly);
        if (mn.kind === CONSTANT.QName) {
          this.cache[mn.id] = object;
        }
        return object;
      }
      if (scopeOnly) {
        return null;
      }
  
      // Attributes can't be stored on globals or be directly defined in scripts.
      if (mn.isAttribute()) {
        this.object.sec.throwError("ReferenceError", Errors.UndefinedVarError, mn.name);
      }
  
      // If we can't find the property look in the domain.
      var globalObject = <AXGlobal><any>this.global.object;
      if ((object = globalObject.applicationDomain.findProperty(mn, strict, true))) {
        return object;
      }
  
      // If we still haven't found it, look for dynamic properties on the global.
      // No need to do this for non-strict lookups as we'll end up returning the
      // global anyways.
      if (strict) {
        if (!(mn.getPublicMangledName() in globalObject)) {
          this.global.object.sec.throwError("ReferenceError", Errors.UndefinedVarError, mn.name);
        }
      }
  
      // Can't find it still, return the global object.
      return globalObject;
    }
  }