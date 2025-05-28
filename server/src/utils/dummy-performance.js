/**
 * Dummy Performance Tracker
 * Empty implementation to replace the deleted performance tracking functionality
 */
class DummyPerformanceTracker {
  constructor() {
    this.metrics = {
      didResolution: [],
      vcIssuance: [],
      vcVerification: [],
      vpCreation: [],
      vpVerification: [],
      bridgeTranslation: [],
      bridgeRoundTrip: []
    };
  }

  // Dummy implementation that returns immediately
  setTracking() {}
  setAutoSave() {}
  
  // Measurement methods that just execute the callback and return the result
  async measureDidResolution(callback) {
    return callback();
  }
  
  async measureVcIssuance(callback) {
    return callback();
  }
  
  async measureVcVerification(callback) {
    return callback();
  }
  
  async measureVpCreation(callback) {
    return callback();
  }
  
  async measureVpVerification(callback) {
    return callback();
  }
  
  async measureBridgeTranslation(callback) {
    return callback();
  }
  
  async measureBridgeRoundTrip(callback) {
    return callback();
  }
  
  // Benchmark methods that return empty results
  async benchmarkDidResolution() {
    return { results: [] };
  }
  
  async benchmarkVcIssuance() {
    return { results: [] };
  }
  
  async benchmarkVcVerification() {
    return { results: [] };
  }
  
  async benchmarkVpCreation() {
    return { results: [] };
  }
  
  async benchmarkVpVerification() {
    return { results: [] };
  }
  
  async benchmarkBridgeTranslation() {
    return { results: [] };
  }
  
  async benchmarkBridgeRoundTrip() {
    return { results: [] };
  }
  
  // Utility methods
  clearMetrics() {}
  saveMetrics() {}
}

module.exports = new DummyPerformanceTracker(); 