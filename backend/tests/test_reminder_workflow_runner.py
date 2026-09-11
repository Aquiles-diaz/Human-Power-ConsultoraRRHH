"""Regresión del cron: no llamar sin secreto ni publicar emails en Actions."""

import importlib.util
import io
import json
from pathlib import Path
import urllib.error
from unittest.mock import MagicMock

import pytest


SPEC = importlib.util.spec_from_file_location(
    "reminder_runner", Path(__file__).resolve().parents[2] / "scripts/run-profile-reminders.py"
)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


@pytest.fixture
def fake_remote(monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "test-only-secret")
    monkeypatch.delenv("GITHUB_STEP_SUMMARY", raising=False)
    monkeypatch.delenv("REMINDERS_DRY_RUN", raising=False)
    opener = MagicMock()
    monkeypatch.setattr(runner.urllib.request, "build_opener", lambda *_: opener)
    monkeypatch.setattr(runner.time, "sleep", MagicMock())
    return opener.open


def response(*, failed=0, dry_run=False):
    return io.BytesIO(json.dumps({
        "eligible": 1, "sent": 0 if dry_run or failed else 1, "failed": failed,
        "dry_run": dry_run, "items": [{"email": "private@example.test"}],
    }).encode())


def test_unconfigured_cron_is_explicitly_omitted_without_network(monkeypatch, fake_remote, capsys):
    monkeypatch.delenv("CRON_SECRET")
    assert runner.main() == 0
    fake_remote.assert_not_called()
    assert "Recordatorios omitidos" in capsys.readouterr().out


@pytest.mark.parametrize("status", [401, 403, 404])
def test_permanent_errors_fail_once(fake_remote, status):
    fake_remote.side_effect = urllib.error.HTTPError(runner.ENDPOINT, status, "error", {}, None)
    assert runner.main() == 1
    assert fake_remote.call_count == 1
    runner.time.sleep.assert_not_called()


def test_transient_error_is_retried(fake_remote):
    fake_remote.side_effect = [
        urllib.error.HTTPError(runner.ENDPOINT, 503, "warming up", {}, None), response()
    ]
    assert runner.main() == 0
    assert fake_remote.call_count == 2
    runner.time.sleep.assert_called_once_with(20)


def test_timeouts_are_bounded(fake_remote):
    fake_remote.side_effect = TimeoutError()
    assert runner.main() == 1
    assert fake_remote.call_count == runner.MAX_ATTEMPTS


def test_dry_run_never_requests_delivery(monkeypatch, fake_remote, capsys):
    monkeypatch.setenv("REMINDERS_DRY_RUN", "true")
    fake_remote.return_value = response(dry_run=True)
    assert runner.main() == 0
    request = fake_remote.call_args.args[0]
    assert request.full_url.endswith("?dry_run=1")
    assert request.get_header("X-cron-secret") == "test-only-secret"
    output = capsys.readouterr().out
    assert "Simulación sin envío" in output
    assert "private@example.test" not in output
    assert "test-only-secret" not in output


def test_partial_delivery_failure_still_alerts(fake_remote, capsys):
    fake_remote.return_value = response(failed=1)
    assert runner.main() == 1
    output = capsys.readouterr().out
    assert "::error::" in output
    assert "private@example.test" not in output


def test_invalid_response_still_alerts(fake_remote):
    fake_remote.return_value = io.BytesIO(b'{"unexpected": true}')
    assert runner.main() == 1


def test_redirect_does_not_forward_secret():
    handler = runner.NoRedirect()
    assert handler.redirect_request(None, None, 302, "redirect", {}, "https://other.test") is None
