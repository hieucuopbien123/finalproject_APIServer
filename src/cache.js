const NodeCache = require( "node-cache" );
// const myCache = new NodeCache( { stdTTL: 20 } ); // Production
const myCache = new NodeCache( { stdTTL: 10000 } ); // Test

const myLongCach = new NodeCache({stdTTL: 100000});

module.exports = {
  myCache,
  myLongCach
}