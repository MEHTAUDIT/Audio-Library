package com.audiolibrary.config;

import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;

@Component
public class SchemaMultiTenantConnectionProvider implements MultiTenantConnectionProvider {

    private final DataSource dataSource;
    private final boolean isH2;

    public SchemaMultiTenantConnectionProvider(DataSource dataSource) {
        this.dataSource = dataSource;
        this.isH2 = detectH2(dataSource);
    }

    @Override
    public Connection getAnyConnection() throws SQLException {
        return dataSource.getConnection();
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        Connection connection = getAnyConnection();
        try {
            connection.setSchema(normalizeSchemaName(tenantIdentifier));
        } catch (SQLException e) {
            try {
                connection.close();
            } catch (SQLException closeException) {
                e.addSuppressed(closeException);
            }
            throw new RuntimeException("Could not switch to schema: " + tenantIdentifier, e);
        }
        return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection) throws SQLException {
        try {
            connection.setSchema(defaultSchema());
        } catch (SQLException e) {
             // log error
        }
        connection.close();
    }

    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return false;
    }

    @Override
    public <T> T unwrap(Class<T> unwrapType) {
        return null;
    }

    private String normalizeSchemaName(String schema) {
        if (schema == null || schema.isBlank()) {
            return defaultSchema();
        }
        // In H2 the default schema is PUBLIC (uppercase). In Postgres it's public (lowercase).
        if (isH2 && "public".equalsIgnoreCase(schema)) {
            return "PUBLIC";
        }
        if (!isH2 && "PUBLIC".equals(schema)) {
            return "public";
        }
        return schema;
    }

    private String defaultSchema() {
        return isH2 ? "PUBLIC" : "public";
    }

    private static boolean detectH2(DataSource ds) {
        try (Connection c = ds.getConnection()) {
            DatabaseMetaData md = c.getMetaData();
            String name = md.getDatabaseProductName();
            return name != null && name.toLowerCase().contains("h2");
        } catch (Exception ignored) {
            // If we can't detect, default to Postgres-like behavior.
            return false;
        }
    }
}

