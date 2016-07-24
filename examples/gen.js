(function(){
'use strict';
  // Constants
  var MIN_LOOP = 8,
      PRE_LOOP = 8,
      TINYMT32_SH0 = 1,
      TINYMT32_SH1 = 10,
      TINYMT32_SH8 = 8,
      TINYMT32_MASK = 0x7fffffff,
      TINYMT32_MUL = 1.0 / 4294967296;

function Generator(seed) {
  // If the seed is set to null then don't seed it. This is useful
  // for when we want to create a new Generator instance and create it
  // from a deserealization and not waste time on the seed logic
  if(seed !== null) {
    this.seed();
  }
}

Generator.prototype = {

  seed: function(seed) {
    // If a seed was not provided use the current time as the seed
    seed = seed ? seed: (new Date()).getTime();

    // TODO: Understand these parameters more. We're hard coding them for now.
    // Need to read through the tinymt academic paper.
    this.mat1 = 0x8f7011ee;
    this.mat2 = 0xfc78ff1f;
    this.tmat = 0x3793fdff;

    this.status = [
      seed,
      this.mat1,
      this.mat2,
      this.tmat
    ];

    var i;
    for(i = 1; i < MIN_LOOP; i++) {
      this.status[i & 3] ^= i + 1812433253
        * (this.status[(i - 1) & 3]
           ^ (this.status[(i - 1) & 3] >> 30));
      }

    period_certification.apply(this);

    for(i = 0; i < PRE_LOOP; i++) {
      tinymt32_next_state.apply(this);
    }
  },

  float: function(){
    var min, max, value;

    // If no min/max were provided range is [0.0, 1.0]
    if(arguments.length === 0 ){
      min = 0.0;
      max = 1.0;
    }
    // If only one parameter is passed, it's treated as the max.
    // Range is [0.0, max]
    else if(arguments.length === 1 ){
      min = 0.0;
      max = arguments[0];
    }
    // If min and max were provided
    else if(arguments.length === 1 ){
      min = arguments[0];
      max = arguments[1];
    }

    value = tinymt32_generate_float.apply(this);
    return value * (max-min) + min;
  },

  integer: function(){
    var min, max, value;

    // If no min/max were provided range is [0.0, 1.0]
    if(arguments.length === 0 ){
      min = 0;

      // Max defaults to 9007199254740992 if not provided
      // This number was based on this Stackoverflow answer:
      // http://stackoverflow.com/questions/307179/what-is-javascripts-highest-integer-value-that-a-number-can-go-to-without-losin#answer-11639621
      max = 1000000;
    }
    // If only one parameter is passed, it's treated as the max.
    // Range is [0.0, max]
    else if(arguments.length === 1 ){
      min = 0;
      max = arguments[0];
    }
    // If min and max were provided
    else if(arguments.length === 2 ){
      min = arguments[0];
      max = arguments[1];
    }

    value = tinymt32_generate_float.apply(this);
    return Math.floor(value * (max-min) + min);
  },

  /*
   * Note that for even rather small len(x), the total number of permutations of x is larger than the period of most random number generators;
   * this implies that most permutations of a long sequence can never be generated.
   */
  shuffle: function(array){
    var output = array.slice(),
        i,
        randomIndex,
        swap;

    // Iterate through each element and swap it's location
    // with another randomly selected element
    for(var i = 0; i<output.length;i++){
      randomIndex = this.integer(output.length-1);
      swap = output[randomIndex];
      output[randomIndex] = output[i];
      output[i] = swap;
    }

    return output;
  },

  choice: function(array){
    return array[this.integer(array.length-1)];
  },

  sample: function(array, k){
    var output = [],
        i;
    for(i = 0; i<k; i++) {
      output.push(this.integer(array.length-1));
    }
    return output;
  }

};

/*-----------------------------------
 * Internal implementation functions
 *-----------------------------------*/

/**
 * This function certificate the period of 2^127-1.
 * @param random tinymt state vector.
 */
function period_certification(){
  if( (this.status[0] & TINYMT32_MASK) == 0 &&
      this.status[1] == 0 &&
      this.status[2] == 0 &&
      this.status[3] == 0) {
    this.status[0] = 'T'.charCodeAt(0);
    this.status[1] = 'I'.charCodeAt(0);
    this.status[2] = 'N'.charCodeAt(0);
    this.status[3] = 'Y'.charCodeAt(0);
  }
}

/**
 * This function changes internal state of tinymt32.
 * Users should not call this function directly.
 * @param random tinymt internal status
 */
function tinymt32_next_state() {
    var x,y;

    y = this.status[3];
    x = (this.status[0] & TINYMT32_MASK)
        ^ this.status[1]
        ^ this.status[2];
    x ^= (x << TINYMT32_SH0);
    y ^= (y >> TINYMT32_SH0) ^ x;

    this.status[0] = this.status[1];
    this.status[1] = this.status[2];
    this.status[2] = x ^ (y << TINYMT32_SH1);
    this.status[3] = y;
    // Need to figure out how to properly translate the original code
    // this.status[1] ^= -((int32_t)(y & 1)) & this.mat1;
    // this.status[2] ^= -((int32_t)(y & 1)) & this.mat2;
    this.status[1] ^= -(y & 1) & this.mat1;
    this.status[2] ^= -(y & 1) & this.mat2;
}

/**
 * This function outputs 32-bit unsigned integer from internal state.
 * Users should not call this function directly.
 * @param random tinymt internal status
 * @return 32-bit unsigned pseudorandom number
 */
function tinymt32_temper() {
    var t0, t1;
    t0 = this.status[3];
    t1 = this.status[0]
         + (this.status[2] >> TINYMT32_SH8);

    t0 ^= t1;
    // Proper translation:
    // t0 ^= -((int32_t)(t1 & 1)) & this.tmat;
    t0 ^= -(t1 & 1) & this.tmat;
    return t0;
}

/**
 * This function outputs floating point number from internal state.
 * This function is implemented using multiplying by 1 / 2^32.
 * floating point multiplication is faster than using union trick in
 * my Intel CPU.
 * @param random tinymt internal status
 * @return floating point number r (0.0 <= r < 1.0)
 */
function tinymt32_generate_float() {
    tinymt32_next_state.apply(this);
    // The 0.5 is a hack I added temporarily to make the range [0.0, 1.0] instad
    // of [-0.5,0.5]. Still trying to figure out the subtlies of the original
    // c implementation behavior that used multiple uint32/int32 casts and bit
    // tricks.
    return tinymt32_temper.apply(this) * TINYMT32_MUL + 0.5;
}


// Create a global generator that people can use by default.
var gen = new Generator();

// Make the Generator constructor available for those wanting
// to manage their own instances.
gen.Generator = Generator;

/* --------------------------------
 * Support multiple module formats
 * --------------------------------*/

// CommonJS module is defined
if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = gen;
}
// Require.js
else if (typeof define === 'function' && define.amd) {
  define(function (require, exports, module) {
    return gen;
  });
}
// Good old regular
else if(typeof window !== 'undefined') {
  window.gen = gen;
}
// wat!?
else {
  throw new Error('Unknown environment');
}

})();