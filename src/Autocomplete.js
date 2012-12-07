////////////////////////////////////
//
// Autocomplete
// MIT-style license. Copyright 2012 Matt V. Murphy
//
////////////////////////////////////
(function(window, document, undefined) {
	"use strict";
	
	var Autocomplete = function(element, options) {
		if ((this.element = (typeof(element) === "string") ? $(element) : element)) {
			if ((this.element.tagName || "").toLowerCase() === "input") {
				this.boundCheckValue = null;
				this.cache = {};
				this.container = null;
				this.elementHasFocus = false;
				this.highlightIdx = -1;
				this.lastValue = "";
				this.shownValues = [];
				this.throttle = -1;
				this.usesTouch = (window.ontouchstart !== undefined);
				this.values = [];
				this.options = {
					useNativeInterface : true, 
					highlightColor : "#ffffff", 
					highlightBgColor : "#3399ff", 
					srcType : "", // "array", "dom", "xml"
					srcData : ""
				};
				
				if (options) {
					for (var option in this.options) {
						if (options[option] !== undefined) {
							this.options[option] = options[option];
						}
					}
				}
				
				this.init();
			}
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.init = function() {
		var srcType = this.options.srcType, 
		    datalist, datalistId, boundSetElementFocus;
		
		// Get values:
		this.values = (srcType === "array") ? (this.options.srcData || []).concat() : 
		              (srcType === "dom") ? this.getDomValues() : 
		              (srcType === "xml") ? this.getXmlValues() : [];
		
		// Get datalist element, set it's innerHTML if source type not "dom":
		if (datalistSupported && this.options.useNativeInterface) {
			return this.setDatalist();
		}
		
		// Remove any attached datalist element if not using native interface:
		if (datalistSupported && (datalistId = this.element.getAttribute("list"))) {
			if ((datalist = $(datalistId))) {
				datalist.parentNode.removeChild(datalist);
			}
			this.element.removeAttribute("list");
		}
		
		// Attach behaviors:
		boundSetElementFocus = bind(this.setElementFocus, this);
		addEvent(this.element, "focus", boundSetElementFocus);
		addEvent(this.element, "blur", boundSetElementFocus);
		if (document.activeElement === this.element) {
			boundSetElementFocus({ type : "focus" });
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.getDomValues = function() {
		var datalistId = this.element.getAttribute("list"), 
		    container = (datalistId) ? ($(datalistId) || {}).parentNode : null, 
		    options = (container) ? container.getElementsByTagName("option") : [], 
		    option, i, v, 
		    values = [];
		
		values = [];
		for (i=0, v=0; option=options[i]; i++) {
			if ((option = option.value) !== undefined) {
				values[v++] = option;
			}
		}
		return values;
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.getXmlValues = function() {
		var xml = parseXML(this.options.srcData), 
		    nodes, node, n, value, v, 
		    values = [];
		
		if ((nodes = (xml.getElementsByTagName("datalist")[0] || {}).childNodes)) {
			for (n=0, v=0; node=nodes[n]; n++) {
				if (node.nodeName === "option" && (value = node.getAttribute("value")) !== null) {
					values[v++] = value;
				}
			}
		}
		
		return values;
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.setDatalist = function() {
		var datalistId = this.element.getAttribute("list"), 
		    container = (this.container = (datalistId && $(datalistId)));
		
		// Generate datalist or set options HTML if source type not "dom":
		if (!container) {
			container = (this.container = document.createElement("datalist"));
			container.id = "list" + Math.ceil(Math.random() * 50000);
			container.innerHTML = this.generateDatalistOptionsHtml();
			this.element.parentNode.appendChild(container);
			this.element.setAttribute("list", container.id);
		} else if (this.options.srcType !== "dom") {
			container.innerHTML = this.generateDatalistOptionsHtml();
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.generateDatalistOptionsHtml = function() {
		if (this.values.length) {
			return "<option value=\"" + this.values.join("\"><option value=\"") + "\">";
		}
		return "";
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.setElementFocus = function(event) {
		var isFocusEvent = (((event || window.event).type || "").toLowerCase() === "focus");
		
		if ((this.elementHasFocus = isFocusEvent)) {
			if (!this.container) {
				this.lastValue = this.element.value;
				this.generateContainer();
				this.addInputListeners(event);
			}
		} else if (this.shownValues.length) {
			this.clearValues();
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.generateContainer = function() {
		var wrapper = document.createElement("div"), 
		    container = (this.container = document.createElement("div")), 
		    eStyle, wDisplay;
		
		// Get element display style and use it for the wrapper display:
		if ((eStyle = window.getComputedStyle) && (eStyle = eStyle(this.element, null))) {
			wDisplay = eStyle.getPropertyValue("display");
		} else if ((eStyle = this.element.currentStyle)) {
			wDisplay = eStyle["display"];
		}
		
		// Initialize container:
		container.className = "aCon";
		if (!this.usesTouch) {
			addEvent(container, "mousemove", bind(this.highlightValue, this));
			if (msie === undefined || msie >= 9) {
				addEvent(container, "mousedown", stopEvent);
				addEvent(container, "mouseup", bind(this.selectValue, this));
			} else {
				addEvent(container, "mousedown", bind(this.selectValue, this));
			}
		} else {
			addEvent(container, "touchstart", bind(this.highlightValue, this));
			addEvent(container, "touchend", bind(this.selectValue, this));
		}
		container.style.minWidth = this.element.offsetWidth + "px";
		container.style.marginTop = this.element.offsetHeight + "px";
		
		// Initialize wrapper and insert into DOM:
		wrapper.className = "aWrapper";
		wrapper.style.display = wDisplay || "block";
		wrapper.appendChild(container);
		this.element.parentNode.insertBefore(wrapper, this.element);
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.addInputListeners = function(event) {
		var boundToggleSelectionChangeEvent;
		
		// Monitor the text field value as it changes:
		this.boundCheckValue = bind(this.checkValue, this);
		if (msie === undefined || msie >= 9) {
			addEvent(this.element, "input", this.boundCheckValue);
			if (msie === 9) {
				boundToggleSelectionChangeEvent = bind(this.toggleSelectionChangeEvent, this);
				addEvent(this.element, "focus", boundToggleSelectionChangeEvent);
				addEvent(this.element, "blur", boundToggleSelectionChangeEvent);
				boundToggleSelectionChangeEvent(event);
			}
		} else {
			addEvent(this.element, "propertychange", bind(this.checkForValuePropertyChange, this));
		}
		
		// Check for arrow navigation and enter/tab key:
		addEvent(this.element, "keydown", bind(this.performKeyAction, this));
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.toggleSelectionChangeEvent = function(event) {
		// Used by MSIE 9 to fill missing parts of oninput event implementation:
		if (((event || window.event).type || "").toLowerCase() === "focus") {
			addEvent(document, "selectionchange", this.boundCheckValue);
		} else {
			removeEvent(document, "selectionchange", this.boundCheckValue);
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.checkForValuePropertyChange = function() {
		// Used by MSIE < 9 to simulate oninput event:
		if (this.elementHasFocus && window.event.propertyName === "value") {
			this.checkValue(window.event);
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.checkValue = function(event) {
		var escapeRgx, matchResult, matchRgx, matchText, results, 
		    newValue = this.element.value, 
		    matches = [], m = 0;
		
		if (newValue !== this.lastValue) {
			if (newValue) {
				if (!(results = this.cache["r-" + newValue])) {
					// Find all matching values:
					escapeRgx = this.cache.escapeRgx || (this.cache.escapeRgx = /([-.*+?^${}()|[\]\/\\])/g);
					matchRgx = new RegExp("^(" + newValue.replace(escapeRgx, "\\$1") + ".*)$", "igm");
					matchText = this.cache.values || (this.cache.values = this.values.join("\n"));
					
					while ((matchResult = (matchRgx.exec(matchText) || [])[0])) {
						if (newValue !== matchResult) {
							matches[m++] = matchResult;
						}
					}
					results = (this.cache["r-" + newValue] = matches.sort().slice(0, Math.min(6, matches.length)));
				}
			}
			if (results && results.length) {
				this.showValues(results);
			} else {
				this.clearValues();
			}
			this.lastValue = newValue;
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.performKeyAction = function(event) {
		var which = (event = event || window.event).which || event.keyCode, 
		    actionable = { 9 : 1, 13 : 1, 38 : 1, 40 : 1 }, 
		    container, shownValuesLen;
		
		if (actionable[which]) {
			// TAB or ENTER key:
			if (which === 9 || which === 13) {
				if (this.highlightIdx > -1) {
					this.selectValue(event);
				} else if (which === 13 && window.opera) {
					window.setTimeout(bind(this.clearValues, this), 0); // Opera bug workaround
				} else {
					this.clearValues();
				}
				
			// DOWN or UP key:
			} else {
				if ((shownValuesLen = this.shownValues.length)) {
					if ((which === 38 && this.highlightIdx === 0) || 
					    (which === 40 && this.highlightIdx === shownValuesLen - 1)) {
						this.setHighlightedIndex(-1);
					} else if (which === 38 && this.highlightIdx === -1) {
						this.setHighlightedIndex(shownValuesLen - 1);
					} else {
						this.setHighlightedIndex(this.highlightIdx + ((which === 38) ? -1 : 1));
					}
				} else {
					this.checkValue(event);
				}
			}
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.showValues = function(values) {
		var html = [], h = 0, 
		    rRgx = /</g, 
		    rStr = "&lt;", 
		    len, i;
		
		// Generate choices list:
		html[h++] = "<ul class='aList'>";
		for (i=0, len=values.length; i<len; i++) {
			html[h++] = "<li data-idx='" + i + "' class='aLim'>" + values[i].replace(rRgx, rStr) + "</li>";
		}
		html[h++] = "</ul>";
		
		// Display and store list:
		this.highlightIdx = -1;
		this.shownValues = values.concat();
		this.container.innerHTML = html.join("");
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.highlightValue = function(event) {
		var target, targetClass, targetStyle, highlightIdx;
		
		if (this.usesTouch || (this.throttle++) & 1) {
			target = (event = event || window.event).target || event.srcElement;
			targetClass = target.className || "";
			
			while (targetClass.indexOf("aLim") === -1 && targetClass !== "aCon") {
				targetClass = (target = target.parentNode).className || "";
			}
			if (targetClass.indexOf("aLim") > -1) {
				if ((highlightIdx = parseInt(target.getAttribute("data-idx") || -1, 10)) > -1) {
					this.setHighlightedIndex(highlightIdx);
				}
			}
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.setHighlightedIndex = function(highlightIdx) {
		var choices, choiceStyle;
		
		if ((highlightIdx = Math.max(-1, highlightIdx)) !== this.highlightIdx) {
			if (highlightIdx < this.shownValues.length) {
				if (highlightIdx > -1 || this.highlightIdx > -1) {
					choices = this.container.firstChild.children;
				}
				
				// Highlight new choice:
				if (highlightIdx > -1) {
					(choiceStyle = choices[highlightIdx].style).color = this.options.highlightColor;
					choiceStyle.backgroundColor = this.options.highlightBgColor;
				}
				
				// Remove prior choice highlighting:
				if (this.highlightIdx > -1) {
					(choiceStyle = choices[this.highlightIdx].style).color = "";
					choiceStyle.backgroundColor = "";
				}
				
				// Save:
				this.highlightIdx = highlightIdx;
			}
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.selectValue = function(event) {
		var eventType = (event = event || window.event).type.toLowerCase(), 
		    returnFocus = eventType !== "keydown" || (event.which || event.keyCode) !== 9, 
		    target, highlightIdx;
		
		// If mouse or touch event, check if clicking on a value that's not currently selected:
		if (eventType.indexOf("mouse") > -1 || eventType.indexOf("touch") > -1) {
			if (((target = event.target || event.srcElement).className || "").indexOf("aLim") > -1) {
				if ((highlightIdx = parseInt(target.getAttribute("data-idx") || -1, 10)) > -1) {
					this.highlightIdx = highlightIdx;
				}
			}
		}
		
		// Select value:
		if (this.highlightIdx > -1) {
			this.element.value = this.shownValues[this.highlightIdx];
			this.clearValues();
		}
		if (returnFocus) {
			this.element.focus();
			return stopEvent(event);
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.clearValues = function() {
		this.highlightIdx = -1;
		this.lastValue = "";
		this.shownValues = [];
		this.container.innerHTML = "";
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.addValues = function(values) {
		var currentValues, cLen, c;
		
		if (values && values.length) {
			cLen = c = (currentValues = this.values).length;
			for (var i=0, value; (value=values[i]) !== undefined; i++) {
				if (value && indexOf(currentValues, value) === -1) {
					currentValues[c++] = value;
				}
			}
			
			if (c > cLen && datalistSupported && this.options.useNativeInterface) {
				this.container.innerHTML = this.generateDatalistOptionsHtml();
			}
		}
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	Autocomplete.prototype.removeValues = function(values) {
		var currentValues, cLen, c, idx;
		
		if (values && values.length) {
			cLen = c = (currentValues = this.values).length;
			for (var i=0, value; (value=values[i]) !== undefined; i++) {
				if (value && (idx = indexOf(currentValues, value)) > -1) {
					currentValues.splice(idx, 1);
				}
			}
			
			if (currentValues.length < cLen && datalistSupported && this.options.useNativeInterface) {
				this.container.innerHTML = this.generateDatalistOptionsHtml();
			}
		}
	};
	
	//////////////////////////////////
	//
	// Utility Methods
	//
	//////////////////////////////////////////////////////////////////////////////////
	var getIEVersion = function() {
		var nav, version;
		
		if ((nav = navigator).appName === "Microsoft Internet Explorer") {
			if (new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})").exec(nav.userAgent)) {
				version = parseFloat(RegExp.$1);
			}
		}
		return (version > 5) ? version : undefined;
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	var parseXML = function(source) {
		var sourceType, dE, xml;
		
		if ((sourceType = typeof(source)) === "string") {
			if (window.DOMParser) {
				xml = new DOMParser().parseFromString(source, "text/xml");
			} else if (window.ActiveXObject) {
				xml = new ActiveXObject("Microsoft.XMLDOM");
				xml.async = false;
				xml.loadXML(source);
			}
		} else if (sourceType === "object") {
			dE = (source.ownerDocument || source).documentElement || {};
			if (dE.nodeName && dE.nodeName.toUpperCase() !== "HTML") {
				xml = source;
			}
		}
		
		return xml || null;
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	var addEvent = (document.addEventListener) ? 
	  function(elem, type, listener) { elem.addEventListener(type, listener, false); } : 
	  function(elem, type, listener) { elem.attachEvent("on" + type, listener); };
	
	//////////////////////////////////////////////////////////////////////////////////
	var stopEvent = function(event) {
		if (event.stopPropagation) {
			event.stopPropagation();
			event.preventDefault();
		} else {
			event.returnValue = false;
			event.cancelBubble = true;
		}
		return false;
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	var removeEvent = (document.addEventListener) ? 
	  function(elem, type, listener) { elem.removeEventListener(type, listener, false); } : 
	  function(elem, type, listener) { elem.detachEvent("on" + type, listener); };
	
	//////////////////////////////////////////////////////////////////////////////////
	var bind = function(func, that, args) {
		var args = [].concat(args || []), 
		    a = args.length;
		
		return function() {
			if (a || arguments.length) {
				for (var i=0, arg; arg=arguments[i]; i++) { args[a+i] = arg; }
				return func.apply(that, args);
			}
			return func.call(that);
		};
	};
	
	//////////////////////////////////////////////////////////////////////////////////
	var indexOf = ([].indexOf) ? 
	  function(arr, item) { return arr.indexOf(item); } : 
	  function(arr, item) {
	  	for (var i=0, len=arr.length; i<len; i++) { if (arr[i] === item) { return i; } } return -1;
	  };
	
	//////////////////////////////////////////////////////////////////////////////////
	var $ = function(elemId) { return document.getElementById(elemId); }, 
	    datalistSupported = !!(("list" in document.createElement("input")) && 
	                           document.createElement("datalist") && 
	                           window.HTMLDataListElement), 
	    msie = getIEVersion();
	
	// Expose:
	window.Autocomplete = Autocomplete;
	
})(this, this.document);
