class Component {
  toString(...args: any[]): string {
    throw new Error("should not be instatiated");
  }
}

class Positional {
  // TODO : for now idx == -1 means plain *, i.e. use current position
  constructor(idx: number = -1) {
    this.idx = idx;
  }
  idx: number;
}
class Directive extends Component {
  verb: string; // todo enum ?
  // flags
  plus: boolean = false;
  hash: boolean = false;
  dash: boolean = false;
  space: boolean = false;
  zero: boolean = false;
  arrow: boolean = false;

  width: number | Positional;
  precision: number | Positional;

  positional: Positional;

  setVerb(verb: string) {
    this.verb = verb;
  }
}
class Literal extends Component {
  str = "";
  append(c: string) {
    this.str += c;
  }
  toString(...args: any[]): string {
    return this.str;
  }
}
export class FormatString {
  stack = new Array<Component>();

  compile(fmt: string) {
    this.reset();
    // TODO check fmt is string ...
    let sm = new Statemachine(this);
    for (let i = 0; i != fmt.length; ++i) {
      sm.process(fmt[i]);
    }
  }
  reset() {
    this.stack = new Array<Component>();
  }

  directive(): Directive {
    if (this.stack[0].constructor !== Directive) {
      throw new Error("can't be!");
    }
    return this.stack[0] as Directive;
  }
  pushNewDirective(): void {
    this.stack.unshift(new Directive());
  }
  literal(): Literal {
    if (this.stack[0].constructor !== Literal) {
      throw new Error("can't be!");
    }
    return this.stack[0] as Literal;
  }
  pushNewLiteral(): void {
    this.stack.unshift(new Literal());
  }

  run(...args: any[]): string {
    // TODO: future direction write directly into stream or somesuch
    let str = "";

    for (let i = this.stack.length - 1; i >= 0; --i) {
      let c = this.stack[i];
      str += c.toString(...args);
    }
    return str;
  }
}

class State {
  name: string;
  formatString: FormatString;
  constructor(name: string, fs: FormatString) {
    this.name = name;
    this.formatString = fs;
  }
  process(char: string): State {
    throw new Error("not implemented");
  }
  onEnter() {}
  onExit() {}
}

// %[flags][width][.precision]type
class FlagsOrPercent extends State {
  constructor(fs: FormatString) {
    super("FlagsOrPercent", fs);
  }
  process(char: string): State {
    if (char === "%") {
      this.formatString.literal().append(char);
      return new PassThrough(this.formatString);
    }
    this.formatString.pushNewDirective();
    let state = new Flags(this.formatString);
    return state.process(char);
  }
}
class Flags extends State {
  constructor(fs: FormatString) {
    super("FlagsOrPercent", fs);
  }
  process(char: string): State {
    switch (char) {
      case "+": // flags
        this.formatString.directive().plus = true;
        return this;
      case "-":
        this.formatString.directive().dash = true;
        return this;
      case "#":
        this.formatString.directive().hash = true;
        return this;
      case " ":
        this.formatString.directive().space = true;
        return this;
      case "0":
        this.formatString.directive().zero = true;
        return this;
      case "<":
        this.formatString.directive().arrow = true;
        return this;
    }
    let state = new Width(this.formatString);
    return state.process(char);
  }
}
class Width extends State {
  constructor(fs: FormatString) {
    super("Width", fs);
  }
  process(char: string): State {
    // width can be * [] or number
    switch (char) {
      case "*":
        this.formatString.directive().width = new Positional();
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        let state = new NumericLiteral(
          "WidthLiteral",
          this.formatString,
          (n, c) => {
            this.formatString.directive().width = n;
            let state2 = new Precision(this.formatString);
            return state2.process(c);
          }
        );
        return state.process(char);
      case "[":
        throw new Error("TODo positional");
    }
    let state = new Precision(this.formatString);
    return state.process(char);
  }
}
class NumericLiteral extends State {
  lambda: (number, string) => State;
  accumulator: number;
  constructor(
    name: string,
    fs: FormatString,
    lambda: (n: number, c: string) => State
  ) {
    super(name, fs);
    this.lambda = lambda;
  }
  process(char: string): State {
    switch (char) {
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
      case "0":
        this.accumulator *= 10;
        this.accumulator += parseInt(char);
        return this;
    }
    return this.lambda(this.accumulator, char);
  }
}

class Precision extends State {
  constructor(fs: FormatString) {
    super("Precision", fs);
  }
  process(char: string): State {
    // precision can be * [] or number
    if (char == ".") {
      return new PrecisionDot(this.formatString);
    }
    let state = new Verb(this.formatString);
    return state.process(char);
  }
}
class PrecisionDot extends State {
  constructor(fs: FormatString) {
    super("PrecisionDot", fs);
  }
  process(char: string): State {
    switch (char) {
      case "*":
        this.formatString.directive().precision = new Positional();
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        let state = new NumericLiteral(
          "PrecisionLiteral",
          this.formatString,
          (n, c) => {
            this.formatString.directive().precision = n;
            let state2 = new Verb(this.formatString);
            return state2.process(c);
          }
        );
        return state.process(char);
      case "[":
        throw new Error("TODo positional");
    }
    let state = new Verb(this.formatString);
    return state.process(char);
  }
}

class Verb extends State {
  constructor(fs: FormatString) {
    super("Verb", fs);
  }
  process(char: string): State {
    switch (char) {
      case "t": // valid verbs
      case "b":
      case "c":
      case "o":
      case "x":
      case "X":
      case "e":
      case "E":
      case "f":
      case "F":
      case "g":
      case "G":
      case "s":
      case "T":
      case "v":
      case "j":
        this.formatString.directive().setVerb(char);
        return new PassThrough(this.formatString);
        break;
      default:
        // can probably set invlaid verb and let Directive format the error,
        // or have strict mode and throw while compiling...
        throw new Error("TODO figure out");
    }
  }
}

// base state, pass through chars until a directive is encountered
// as indicated by '%'
class PassThrough extends State {
  constructor(fs: FormatString) {
    super("PassThrough", fs);
  }
  process(char: string): State {
    switch (char) {
      case "%":
        return new FlagsOrPercent(this.formatString);
      default:
        this.formatString.literal().append(char);
    }
    return this;
  }
  onEnter() {
    this.formatString.pushNewLiteral();
  }
}

class Statemachine {
  formatString: FormatString;
  currentState: State;
  constructor(f: FormatString) {
    this.formatString = f;
    this.currentState = new PassThrough(this.formatString);
    this.currentState.onEnter();
  }
  process(char: string) {
    let oldState = this.currentState;
    this.currentState = oldState.process(char);
    if (oldState !== this.currentState) {
      oldState.onExit();
      this.currentState.onEnter();
    }
  }
}
