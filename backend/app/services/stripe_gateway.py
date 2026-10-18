"""Every Stripe API call goes through this module.

Keeping the surface small makes the payment logic testable: tests replace these
functions with fakes, and nothing else in the app imports `stripe` directly.

Model: Stripe Connect **Express** with **destination charges** — the Checkout
Session / PaymentIntent is created on the platform account with
`transfer_data.destination = <owner's connected account>`, so the rent lands in
the owner's account and all events arrive on the platform webhook.
"""
from __future__ import annotations

from typing import Any

import stripe

from app.core.config import settings


def _client() -> None:
    stripe.api_key = settings.stripe_secret_key


# ── Connected accounts (owners) ──────────────────────────────────────────────


def create_express_account(email: str, org_name: str, org_id: str) -> str:
    _client()
    account = stripe.Account.create(
        type="express",
        country="US",
        email=email,
        business_profile={"name": org_name, "product_description": "Residential rent collection"},
        capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}, "us_bank_account_ach_payments": {"requested": True}},
        metadata={"org_id": org_id},
    )
    return account.id


def onboarding_link(account_id: str, return_url: str, refresh_url: str) -> str:
    _client()
    link = stripe.AccountLink.create(account=account_id, return_url=return_url, refresh_url=refresh_url, type="account_onboarding")
    return link.url


def dashboard_link(account_id: str) -> str:
    _client()
    return stripe.Account.create_login_link(account_id).url


def account_status(account_id: str) -> dict[str, bool]:
    _client()
    a = stripe.Account.retrieve(account_id)
    return {
        "charges_enabled": bool(a.charges_enabled),
        "payouts_enabled": bool(a.payouts_enabled),
        "details_submitted": bool(a.details_submitted),
    }


# ── Customers (tenants) ──────────────────────────────────────────────────────


def create_customer(email: str | None, name: str, metadata: dict[str, str]) -> str:
    _client()
    return stripe.Customer.create(email=email or None, name=name, metadata=metadata).id


# ── Payments ─────────────────────────────────────────────────────────────────


def checkout_payment(
    *,
    customer_id: str,
    destination: str,
    method: str,
    rent_cents: int,
    fee_cents: int,
    description: str,
    metadata: dict[str, str],
    success_url: str,
    cancel_url: str,
) -> tuple[str, str]:
    """Hosted Checkout for a one-off rent payment. Returns (session_id, url)."""
    _client()
    items = [{"price_data": {"currency": "usd", "product_data": {"name": description}, "unit_amount": rent_cents}, "quantity": 1}]
    if fee_cents:
        items.append({"price_data": {"currency": "usd", "product_data": {"name": "Card processing fee"}, "unit_amount": fee_cents}, "quantity": 1})
    session = stripe.checkout.Session.create(
        mode="payment",
        customer=customer_id,
        payment_method_types=[method],
        line_items=items,
        payment_intent_data={"transfer_data": {"destination": destination}, "metadata": metadata, "description": description},
        metadata=metadata,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return session.id, session.url


def checkout_setup(*, customer_id: str, metadata: dict[str, str], success_url: str, cancel_url: str) -> tuple[str, str]:
    """Hosted Checkout that only saves a payment method (for autopay). Returns (session_id, url)."""
    _client()
    session = stripe.checkout.Session.create(
        mode="setup",
        customer=customer_id,
        payment_method_types=["us_bank_account", "card"],
        setup_intent_data={"metadata": metadata},
        metadata=metadata,
        success_url=success_url,
        cancel_url=cancel_url,
        currency="usd",
    )
    return session.id, session.url


def setup_intent_payment_method(setup_intent_id: str) -> dict[str, str]:
    """Returns {id, type, label} for the payment method saved by a SetupIntent."""
    _client()
    si = stripe.SetupIntent.retrieve(setup_intent_id, expand=["payment_method"])
    pm = si.payment_method
    if pm.type == "card":
        label = f"{pm.card.brand.title()} •••• {pm.card.last4}"
    elif pm.type == "us_bank_account":
        label = f"{pm.us_bank_account.bank_name or 'Bank'} •••• {pm.us_bank_account.last4}"
    else:
        label = pm.type
    return {"id": pm.id, "type": pm.type, "label": label}


def charge_saved_method(
    *,
    customer_id: str,
    payment_method_id: str,
    destination: str,
    amount_cents: int,
    description: str,
    metadata: dict[str, str],
    idempotency_key: str,
) -> str:
    """Off-session charge for autopay. Returns the PaymentIntent id; the outcome arrives by webhook."""
    _client()
    pi = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        customer=customer_id,
        payment_method=payment_method_id,
        off_session=True,
        confirm=True,
        transfer_data={"destination": destination},
        description=description,
        metadata=metadata,
        payment_method_types=["card", "us_bank_account"],
        idempotency_key=idempotency_key,
    )
    return pi.id


def detach_payment_method(payment_method_id: str) -> None:
    _client()
    stripe.PaymentMethod.detach(payment_method_id)


# ── Webhooks ─────────────────────────────────────────────────────────────────


def parse_webhook(payload: bytes, signature: str) -> dict[str, Any]:
    """Verify the Stripe-Signature header and return the event as a plain dict."""
    event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    return event.to_dict()


# ── Proppros subscriptions (Stripe Billing, platform account) ────────────────


def create_billing_customer(email: str, org_name: str, org_id: str) -> str:
    _client()
    return stripe.Customer.create(email=email, name=org_name, metadata={"org_id": org_id, "purpose": "proppros_subscription"}).id


def checkout_subscription(*, customer_id: str, price_id: str, quantity: int, org_id: str, success_url: str, cancel_url: str) -> str:
    _client()
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": quantity}],
        subscription_data={"metadata": {"org_id": org_id}},
        metadata={"org_id": org_id, "purpose": "subscription"},
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
    )
    return session.url


def billing_portal(customer_id: str, return_url: str) -> str:
    _client()
    return stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url).url


def set_subscription_quantity(subscription_id: str, quantity: int) -> bool:
    """Returns True if the quantity changed."""
    _client()
    sub = stripe.Subscription.retrieve(subscription_id)
    item = sub["items"]["data"][0]
    if item["quantity"] == quantity:
        return False
    stripe.SubscriptionItem.modify(item["id"], quantity=quantity, proration_behavior="create_prorations")
    return True
