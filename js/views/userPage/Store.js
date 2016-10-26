import app from '../../app';
import loadTemplate from '../../utils/loadTemplate';
import Listing from '../../models/listing/Listing';
import BaseVw from '../baseVw';
import ListingShort from '../ListingShort';
import ListingDetail from '../modals/listingDetail/Listing';

export default class extends BaseVw {
  constructor(options = {}) {
    super(options);
    this.options = options;

    if (!this.collection) {
      throw new Error('Please provide a collection.');
    }

    if (!this.model) {
      throw new Error('Please provide a model.');
    }

    this.listingShortViews = [];

    if (options.initialFetch) {
      this.fetch = options.initialFetch;
      this.onRequest(this.collection, this.fetch);
    }

    this.listenTo(this.collection, 'request', this.onRequest);
  }

  className() {
    return 'userPageStore';
  }

  events() {
    return {
      'click .js-retryFetch': 'onClickRetryFetch',
    };
  }

  onRequest(cl, xhr) {
    this.fetch = xhr;
    if (!this.retryPressed) this.render();

    const startTime = Date.now();

    xhr.always(() => {
      if (xhr.state() === 'rejected') {
        // if fetch is triggered by retry button and
        // it immediately fails, it looks like nothing happend,
        // so, we'll make sure it takes a minimum time.
        const callTime = Date.now() - startTime;

        if (callTime < 250) {
          setTimeout(() => {
            this.retryPressed = false;
            this.render();
          }, 250 - callTime);
        }
      } else {
        this.retryPressed = false;
        this.render();
      }
    });
  }

  onClickRetryFetch() {
    this.retryPressed = true;
    this.collection.fetch();
    this.$btnRetry.addClass('processing');
  }

  showListing(listing, listingFetch = false) {
    if (!listing instanceof Listing) {
      throw new Error('Please provide a listing model.');
    }

    if (this.listing) {
      this.listing.remove();
    }

    let initialListingFetch = listingFetch;

    if (!listingFetch) {
      initialListingFetch = listing.fetch();
    }

    this.listingDetail = new ListingDetail({
      model: listing,
      initialFetch: initialListingFetch,
      removeOnClose: false,
    }).render()
      .open();

    this.listingDetail.on('close', () => {
      // The timeout is to ensure the modal wasn't closed because of
      // being routeed to a different page. In that case this view
      // will be removed and we shouldn't update our route.
      setTimeout(() => {
        if (!this.isRemoved()) {
          app.router.navigate(`${this.model.id}/store`);
        }
      });
    });
  }

  createListingShortView(opts = {}) {
    return this.createChild(ListingShort, opts);
  }

  get tabClass() {
    return 'store';
  }

  get $btnRetry() {
    return this._$btnRetry || this.$('.js-retryFetch');
  }

  render() {
    loadTemplate('userPage/userPageStore.html', (t) => {
      this.$el.html(t({
        listings: this.collection.toJSON(),
        isFetching: this.fetch && this.fetch.state() === 'pending',
        fetchFailed: this.fetch && this.fetch.state() === 'rejected',
        fetchFailReason: this.fetch && this.fetch.state() === 'rejected' &&
          this.fetch.responseText || '',
      }));
    });

    this._$btnRetry = null;

    if (!this.rendered && this.options.listing) {
      // if first render, show any listing that was
      // passed in as a view option
      this.showListing(this.options.listing, this.options.initialListingFetch);
      this.rendered = true;
    }

    this.listingShortViews.forEach(vw => vw.remove());
    this.listingShortViews = [];
    const listingsFrag = document.createDocumentFragment();

    this.collection.forEach(listingShort => {
      const listingShortVw = this.createListingShortView({
        model: listingShort,
        listingOwnerGuid: this.model.id,
      });

      this.listingShortViews.push(listingShortVw);
      listingShortVw.render().$el.appendTo(listingsFrag);
    });

    this.$('.js-listingsWrap').append(listingsFrag);

    return this;
  }
}