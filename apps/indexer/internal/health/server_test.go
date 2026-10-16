package health

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestHealthz_AlwaysOK(t *testing.T) {
	s := New(0, nil, nil)
	rec := httptest.NewRecorder()
	s.healthz(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestReadyz_RespectsReadyFlag(t *testing.T) {
	s := New(0, nil, nil)

	rec := httptest.NewRecorder()
	s.readyz(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)

	s.MarkReady()
	rec = httptest.NewRecorder()
	s.readyz(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestReadyz_ReportsParkedLogsWithoutFailing(t *testing.T) {
	s := New(0, nil, func() int64 { return 3 })
	s.MarkReady()
	rec := httptest.NewRecorder()
	s.readyz(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"status":"degraded","dead_letters":3}`, rec.Body.String())
}

func TestReadyz_ReadyWhenNothingIsParked(t *testing.T) {
	s := New(0, nil, func() int64 { return 0 })
	s.MarkReady()
	rec := httptest.NewRecorder()
	s.readyz(rec, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	assert.JSONEq(t, `{"status":"ready"}`, rec.Body.String())
}
